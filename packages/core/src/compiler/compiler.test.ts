/**
 * Tests for the AST Compiler
 */

import { describe, it, expect } from 'vitest';
import { parseSpell } from './ast.js';
import {
    ValidationPass,
    ImportCollectionPass,
    TelemetryInjectionPass,
    ResilienceInjectionPass,
    SecretInjectionPass,
} from './passes.js';
import { SpellbookCompiler, compileSpell } from './compiler.js';
import type { Spell } from '../types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const httpSpell: Spell = {
    id: 'test-http-spell',
    name: 'test-api',
    description: 'A test HTTP API spell',
    transport: 'stdio',
    tools: [{
        name: 'get-data',
        description: 'Fetches data from API',
        action: {
            type: 'http',
            config: {
                url: 'https://api.example.com/data/{{id}}',
                method: 'GET',
                headers: { 'Authorization': 'Bearer token123' },
            },
        },
        inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
        outputSchema: { type: 'object' },
    }],
};

const scriptSpell: Spell = {
    id: 'test-script-spell',
    name: 'calculator',
    description: 'A test calculator spell',
    transport: 'stdio',
    tools: [{
        name: 'calculate',
        description: 'Performs calculation',
        action: {
            type: 'script',
            config: {
                runtime: 'node',
                execution: 'isolated',
                code: 'return { result: input.a + input.b };',
            },
        },
        inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } },
        outputSchema: { type: 'object' },
    }],
};

const sseSpell: Spell = {
    ...httpSpell,
    name: 'sse-api',
    transport: 'sse',
};

// ============================================================================
// AST Parser Tests
// ============================================================================

describe('AST Parser', () => {
    it('parses HTTP spell correctly', () => {
        const ast = parseSpell(httpSpell);

        expect(ast.type).toBe('spell');
        expect(ast.name).toBe('test-api');
        expect(ast.tools).toHaveLength(1);
        expect(ast.tools[0].action.type).toBe('httpAction');
    });

    it('parses script spell correctly', () => {
        const ast = parseSpell(scriptSpell);

        expect(ast.tools[0].action.type).toBe('scriptAction');
        if (ast.tools[0].action.type === 'scriptAction') {
            expect(ast.tools[0].action.execution).toBe('isolated');
        }
    });

    it('detects interpolation paths', () => {
        const ast = parseSpell(httpSpell);
        const action = ast.tools[0].action;

        if (action.type === 'httpAction') {
            expect(action.hasInterpolation).toBe(true);
            expect(action.interpolationPaths).toContain('id');
        }
    });

    it('parses transport correctly', () => {
        const stdioAst = parseSpell(httpSpell);
        const sseAst = parseSpell(sseSpell);

        expect(stdioAst.transport.mode).toBe('stdio');
        expect(sseAst.transport.mode).toBe('sse');
    });
});

// ============================================================================
// Compilation Pass Tests
// ============================================================================

describe('Compilation Passes', () => {
    describe('ValidationPass', () => {
        it('validates correct spell names', () => {
            const pass = new ValidationPass();
            const ast = parseSpell(httpSpell);
            const result = pass.transform(ast);

            expect(result.metadata?.isValid).toBe(true);
        });

        it('catches invalid spell names', () => {
            const pass = new ValidationPass();
            const invalidSpell = { ...httpSpell, name: 'Invalid Name!' };
            const ast = parseSpell(invalidSpell as Spell);
            const result = pass.transform(ast);

            expect(result.metadata?.isValid).toBe(false);
            expect(result.metadata?.validationErrors).toBeDefined();
        });
    });

    describe('ImportCollectionPass', () => {
        it('adds MCP SDK imports', () => {
            const pass = new ImportCollectionPass();
            const ast = parseSpell(httpSpell);
            const result = pass.transform(ast);

            expect(result.imports.some(i => i.module.includes('modelcontextprotocol'))).toBe(true);
        });

        it('adds isolated-vm for sandboxed scripts', () => {
            const pass = new ImportCollectionPass();
            const ast = parseSpell(scriptSpell);
            const result = pass.transform(ast);

            expect(result.imports.some(i => i.module === 'isolated-vm')).toBe(true);
        });

        it('adds express for SSE transport', () => {
            const pass = new ImportCollectionPass();
            const ast = parseSpell(sseSpell);
            const result = pass.transform(ast);

            expect(result.imports.some(i => i.module === 'express')).toBe(true);
        });
    });

    describe('TelemetryInjectionPass', () => {
        it('adds telemetry middleware to tools', () => {
            const pass = new TelemetryInjectionPass();
            const ast = parseSpell(httpSpell);
            const result = pass.transform(ast);

            expect(result.tools[0].middleware.some(m => m.name === 'telemetry')).toBe(true);
        });
    });

    describe('ResilienceInjectionPass', () => {
        it('adds retry middleware to HTTP actions', () => {
            const pass = new ResilienceInjectionPass({ retryAttempts: 5 });
            const ast = parseSpell(httpSpell);
            const result = pass.transform(ast);

            const retryMiddleware = result.tools[0].middleware.find(m => m.name === 'retry');
            expect(retryMiddleware).toBeDefined();
            expect(retryMiddleware?.config.maxAttempts).toBe(5);
        });

        it('does not add retry to script actions', () => {
            const pass = new ResilienceInjectionPass();
            const ast = parseSpell(scriptSpell);
            const result = pass.transform(ast);

            expect(result.tools[0].middleware.some(m => m.name === 'retry')).toBe(false);
        });
    });
});

// ============================================================================
// Full Compiler Tests
// ============================================================================

describe('SpellbookCompiler', () => {
    it('compiles HTTP spell successfully', () => {
        const result = compileSpell(httpSpell);

        expect(result.success).toBe(true);
        expect(result.files).toBeDefined();
        expect(result.files!['index.js']).toContain('fetch(');
        expect(result.files!['package.json']).toBeDefined();
        expect(result.files!['Dockerfile']).toBeDefined();
    });

    it('compiles script spell with isolation', () => {
        const result = compileSpell(scriptSpell);

        expect(result.success).toBe(true);
        expect(result.files!['index.js']).toContain('ivm.Isolate');
    });

    it('generates K8s manifests for SSE transport', () => {
        const result = compileSpell(sseSpell);

        expect(result.success).toBe(true);
        expect(result.files!['k8s.yaml']).toBeDefined();
        expect(result.files!['k8s.yaml']).toContain('Deployment');
    });

    it('tracks pass execution times', () => {
        const result = compileSpell(httpSpell);

        expect(result.passes.length).toBeGreaterThan(0);
        expect(result.passes[0].name).toBeDefined();
        expect(result.passes[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('returns validation errors for invalid spells', () => {
        const invalidSpell = { ...httpSpell, name: 'INVALID!' };
        const result = compileSpell(invalidSpell as Spell);

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
    });

    it('supports custom passes', () => {
        const customPass = {
            name: 'custom-pass',
            transform: (ast: any) => ({
                ...ast,
                metadata: { ...ast.metadata, customPassRan: true },
            }),
        };

        const compiler = new SpellbookCompiler({ customPasses: [customPass] });
        const result = compiler.compile(httpSpell);

        expect(result.ast.metadata?.customPassRan).toBe(true);
    });
});
