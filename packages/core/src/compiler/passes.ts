/**
 * Spellbook Compiler: Compilation Passes
 * 
 * Each pass transforms the AST in a specific way.
 * Passes are composable and testable in isolation.
 */

import type { SpellAST, ImportNode, MiddlewareNode, ToolNode, ActionNode } from './ast.js';
import { NAME_PATTERN } from '../types.js';

const ENV_HEADER_PREFIX = '__SPELLBOOK_ENV__:';

// ============================================================================
// Pass Interface
// ============================================================================

export interface CompilationPass {
    /** Pass name for logging/debugging */
    name: string;

    /** Transform the AST */
    transform(ast: SpellAST): SpellAST;
}

// ============================================================================
// Import Collection Pass
// ============================================================================

/**
 * Analyzes AST and adds required imports.
 */
export class ImportCollectionPass implements CompilationPass {
    name = 'import-collection';

    transform(ast: SpellAST): SpellAST {
        const imports: ImportNode[] = [];

        // Core MCP SDK imports
        imports.push({
            type: 'import',
            module: '@modelcontextprotocol/sdk/server/index.js',
            namedImports: ['Server'],
        });
        imports.push({
            type: 'import',
            module: '@modelcontextprotocol/sdk/types.js',
            namedImports: ['CallToolRequestSchema', 'ListToolsRequestSchema'],
        });

        // Transport-specific imports
        if (ast.transport.mode === 'stdio') {
            imports.push({
                type: 'import',
                module: '@modelcontextprotocol/sdk/server/stdio.js',
                namedImports: ['StdioServerTransport'],
            });
        } else {
            imports.push({
                type: 'import',
                module: '@modelcontextprotocol/sdk/server/sse.js',
                namedImports: ['SSEServerTransport'],
            });
            imports.push({
                type: 'import',
                module: 'express',
                defaultImport: 'express',
            });
        }

        // Validation
        imports.push({
            type: 'import',
            module: 'ajv',
            defaultImport: 'Ajv',
        });

        // Check for isolated-vm usage
        const hasIsolated = ast.tools.some(t =>
            t.action.type === 'scriptAction' && t.action.execution === 'isolated'
        );
        if (hasIsolated) {
            imports.push({
                type: 'import',
                module: 'isolated-vm',
                defaultImport: 'ivm',
            });
        }

        // Check for interpolation
        const hasInterpolation = ast.tools.some(t =>
            t.action.type === 'httpAction' && t.action.hasInterpolation
        );

        return {
            ...ast,
            imports,
            metadata: {
                ...ast.metadata,
                hasIsolated,
                hasInterpolation,
            },
        };
    }
}

// ============================================================================
// Telemetry Injection Pass
// ============================================================================

/**
 * Injects telemetry/logging into tool handlers.
 */
export class TelemetryInjectionPass implements CompilationPass {
    name = 'telemetry-injection';

    transform(ast: SpellAST): SpellAST {
        const tools = ast.tools.map(tool => ({
            ...tool,
            middleware: [
                ...tool.middleware,
                {
                    type: 'middleware' as const,
                    name: 'telemetry',
                    config: {
                        logLevel: 'info',
                        includeInput: false,
                        includeDuration: true,
                    },
                },
            ],
        }));

        return { ...ast, tools };
    }
}

// ============================================================================
// Resilience Injection Pass
// ============================================================================

/**
 * Injects retry and timeout logic for HTTP actions.
 */
export class ResilienceInjectionPass implements CompilationPass {
    name = 'resilience-injection';

    constructor(private options: {
        retryAttempts?: number;
        timeout?: number;
    } = {}) { }

    transform(ast: SpellAST): SpellAST {
        const tools = ast.tools.map(tool => {
            if (tool.action.type !== 'httpAction') return tool;

            return {
                ...tool,
                middleware: [
                    ...tool.middleware,
                    {
                        type: 'middleware' as const,
                        name: 'retry',
                        config: {
                            maxAttempts: this.options.retryAttempts ?? 3,
                            baseDelay: 1000,
                            maxDelay: 10000,
                        },
                    },
                    {
                        type: 'middleware' as const,
                        name: 'timeout',
                        config: {
                            ms: this.options.timeout ?? 30000,
                        },
                    },
                ],
            };
        });

        return { ...ast, tools };
    }
}

// ============================================================================
// Validation Pass
// ============================================================================

/**
 * Validates the AST for correctness.
 */
export class ValidationPass implements CompilationPass {
    name = 'validation';

    transform(ast: SpellAST): SpellAST {
        const errors: string[] = [];

        // Validate spell name
        if (!NAME_PATTERN.test(ast.name)) {
            errors.push(`Invalid spell name: ${ast.name}`);
        }

        // Validate tools
        for (const tool of ast.tools) {
            if (!NAME_PATTERN.test(tool.name)) {
                errors.push(`Invalid tool name: ${tool.name}`);
            }

            // Validate HTTP URLs
            if (tool.action.type === 'httpAction') {
                try {
                    // Replace interpolation placeholders temporarily
                    const testUrl = tool.action.url.replace(/\{\{[\w.]+\}\}/g, 'test');
                    new URL(testUrl);
                } catch {
                    errors.push(`Invalid URL in tool ${tool.name}: ${tool.action.url}`);
                }
            }
        }

        if (errors.length > 0) {
            return {
                ...ast,
                metadata: {
                    ...ast.metadata,
                    validationErrors: errors,
                    isValid: false,
                },
            };
        }

        return {
            ...ast,
            metadata: {
                ...ast.metadata,
                isValid: true,
            },
        };
    }
}

// ============================================================================
// Secret Injection Pass
// ============================================================================

/**
 * Transforms hardcoded secrets to environment variable references.
 */
export class SecretInjectionPass implements CompilationPass {
    name = 'secret-injection';

    transform(ast: SpellAST): SpellAST {
        const tools = ast.tools.map(tool => {
            if (tool.action.type !== 'httpAction') return tool;

            // Check headers for potential secrets
            const headers = tool.action.headers;
            if (!headers) return tool;

            const transformedHeaders: Record<string, string> = {};
            const envVars: string[] = [];

            for (const [key, value] of Object.entries(headers)) {
                // Check for Authorization header or API key patterns
                if (key.toLowerCase() === 'authorization' ||
                    key.toLowerCase().includes('api') ||
                    key.toLowerCase().includes('key')) {
                    const envVar = `${tool.name.toUpperCase().replace(/-/g, '_')}_${key.toUpperCase().replace(/-/g, '_')}`;
                    transformedHeaders[key] = `${ENV_HEADER_PREFIX}${envVar}`;
                    envVars.push(envVar);
                } else {
                    transformedHeaders[key] = value;
                }
            }

            return {
                ...tool,
                action: {
                    ...tool.action,
                    headers: transformedHeaders,
                },
                metadata: {
                    ...tool.metadata,
                    envVars,
                },
            };
        });

        return { ...ast, tools };
    }
}
