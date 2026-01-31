/**
 * Spellbook AST Compiler
 * 
 * Abstract Syntax Tree representation of spells for
 * multi-pass compilation with transformation and optimization.
 */

import type { Spell, Action, HTTPConfig, ScriptConfig } from '../types.js';

// ============================================================================
// AST Node Types
// ============================================================================

export type ASTNodeType =
    | 'spell'
    | 'tool'
    | 'action'
    | 'httpAction'
    | 'scriptAction'
    | 'parameter'
    | 'schema'
    | 'auth'
    | 'transport'
    | 'import'
    | 'middleware'
    | 'handler';

export interface ASTNode {
    type: ASTNodeType;
    location?: {
        start: number;
        end: number;
    };
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Spell AST
// ============================================================================

export interface SpellAST extends ASTNode {
    type: 'spell';
    id: string;
    name: string;
    description: string;
    transport: TransportNode;
    auth?: AuthNode;
    tools: ToolNode[];
    imports: ImportNode[];
    middleware: MiddlewareNode[];
}

export interface TransportNode extends ASTNode {
    type: 'transport';
    mode: 'stdio' | 'sse';
    config: {
        port?: number;
        healthEnabled?: boolean;
    };
}

export interface AuthNode extends ASTNode {
    type: 'auth';
    authType: 'none' | 'apiKey' | 'bearer' | 'oauth2';
    config: Record<string, unknown>;
}

export interface ToolNode extends ASTNode {
    type: 'tool';
    name: string;
    description: string;
    inputSchema: SchemaNode;
    outputSchema: SchemaNode;
    action: ActionNode;
    middleware: MiddlewareNode[];
}

export interface SchemaNode extends ASTNode {
    type: 'schema';
    jsonSchema: Record<string, unknown>;
}

export type ActionNode = HTTPActionNode | ScriptActionNode;

export interface HTTPActionNode extends ASTNode {
    type: 'httpAction';
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
    hasInterpolation: boolean;
    interpolationPaths: string[];
}

export interface ScriptActionNode extends ASTNode {
    type: 'scriptAction';
    runtime: 'node';
    execution: 'unsafe' | 'isolated';
    code: string;
}

export interface ImportNode extends ASTNode {
    type: 'import';
    module: string;
    namedImports?: string[];
    defaultImport?: string;
}

export interface MiddlewareNode extends ASTNode {
    type: 'middleware';
    name: string;
    config: Record<string, unknown>;
}

export interface HandlerNode extends ASTNode {
    type: 'handler';
    toolName: string;
    code: string;
}

// ============================================================================
// Parse Spell to AST
// ============================================================================

/**
 * Parse a Spell definition into an AST.
 */
export function parseSpell(spell: Spell): SpellAST {
    return {
        type: 'spell',
        id: spell.id,
        name: spell.name,
        description: spell.description,
        transport: parseTransport(spell),
        auth: spell.auth ? parseAuth(spell.auth) : undefined,
        tools: spell.tools.map(parseTool),
        imports: [], // Populated by passes
        middleware: [], // Populated by passes
    };
}

function parseTransport(spell: Spell): TransportNode {
    return {
        type: 'transport',
        mode: spell.transport ?? 'stdio',
        config: {
            port: 3000,
            healthEnabled: spell.transport === 'sse',
        },
    };
}

function parseAuth(auth: NonNullable<Spell['auth']>): AuthNode {
    let config: Record<string, unknown> = {};

    if (auth.type === 'oauth2') {
        config = auth.config as Record<string, unknown>;
    } else if (auth.type === 'apiKey') {
        config = { envVar: auth.envVar, headerKey: auth.headerKey };
    } else if (auth.type === 'bearer') {
        config = { envVar: auth.envVar };
    }

    return {
        type: 'auth',
        authType: auth.type,
        config,
    };
}

function parseTool(tool: Spell['tools'][0]): ToolNode {
    return {
        type: 'tool',
        name: tool.name,
        description: tool.description,
        inputSchema: {
            type: 'schema',
            jsonSchema: tool.inputSchema,
        },
        outputSchema: {
            type: 'schema',
            jsonSchema: tool.outputSchema,
        },
        action: parseAction(tool.action),
        middleware: [],
    };
}

function parseAction(action: Action): ActionNode {
    if (action.type === 'http') {
        const config = action.config as HTTPConfig;
        const interpolationPaths = collectInterpolationPaths([
            config.url,
            config.body,
            ...(config.headers ? Object.values(config.headers) : []),
        ]);

        return {
            type: 'httpAction',
            url: config.url,
            method: config.method,
            headers: config.headers,
            body: config.body,
            hasInterpolation: interpolationPaths.length > 0,
            interpolationPaths,
        };
    } else {
        const config = action.config as ScriptConfig;
        return {
            type: 'scriptAction',
            runtime: config.runtime,
            execution: config.execution ?? 'isolated',
            code: config.code,
        };
    }
}

function extractInterpolationPaths(str: string): string[] {
    const matches = str.match(/\{\{([\w.]+)\}\}/g) || [];
    return matches.map(m => m.slice(2, -2));
}

function collectInterpolationPaths(values: Array<string | undefined>): string[] {
    const paths = new Set<string>();
    for (const value of values) {
        if (!value) continue;
        for (const path of extractInterpolationPaths(value)) {
            paths.add(path);
        }
    }
    return Array.from(paths);
}
