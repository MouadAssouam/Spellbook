
import { describe, it, expect } from 'vitest';
import { templates } from './templates.js';
import type { Spell } from './types.js';

describe('Feature: OAuth 2.1', () => {
    const oauthSpell: Spell = {
        id: '123',
        name: 'oauth-test',
        description: 'OAuth Test',
        auth: {
            type: 'oauth2',
            config: {
                clientId: 'cid',
                clientSecret: 'csec',
                authUrl: 'https://auth',
                tokenUrl: 'https://token',
                scopes: ['read'],
                tokenEnvVar: 'MY_TOKEN',
                clientSecretEnvVar: 'CLIENT_SECRET'
            }
        },
        tools: [
            {
                name: 'test-tool',
                description: 'desc',
                inputSchema: {},
                outputSchema: {},
                action: {
                    type: 'http',
                    config: { url: 'https://api.com', method: 'GET' }
                }
            }
        ],
        transport: 'stdio'
    };

    it('generates package.json with OAuth dependencies', () => {
        const pkg = JSON.parse(templates.packageJson(oauthSpell));
        expect(pkg.dependencies).toHaveProperty('express');
        expect(pkg.dependencies).toHaveProperty('axios');
        expect(pkg.dependencies).toHaveProperty('open');
    });

    it('generates setup-auth.js sidecar', () => {
        const code = templates.oauthSetup(oauthSpell);
        expect(code).not.toBeNull();
        expect(code).toContain('const CLIENT_ID = \'cid\'');
        expect(code).toContain('app.listen(PORT');
    });
});

describe('Feature: Sandbox Execution', () => {
    const sandboxSpell: Spell = {
        id: '456',
        name: 'sandbox-test',
        description: 'Sandbox Test',
        tools: [
            {
                name: 'unsafe-script',
                description: 'desc',
                inputSchema: {},
                outputSchema: {},
                action: {
                    type: 'script',
                    config: { runtime: 'node', code: 'return 1', execution: 'isolated' }
                }
            }
        ],
        transport: 'stdio'
    };

    it('generates package.json with isolated-vm', () => {
        const pkg = JSON.parse(templates.packageJson(sandboxSpell));
        expect(pkg.dependencies).toHaveProperty('isolated-vm');
    });

    it('generates server code with isolated-vm logic', () => {
        const code = templates.serverCode(sandboxSpell);
        expect(code).toContain("import ivm from 'isolated-vm'");
        expect(code).toContain('new ivm.Isolate');
    });
});

describe('Feature: Remote Transport (SSE)', () => {
    const sseSpell: Spell = {
        id: '789',
        name: 'sse-test',
        description: 'SSE Test',
        transport: 'sse',
        tools: [
            {
                name: 'test-tool',
                description: 'desc',
                inputSchema: {},
                outputSchema: {},
                action: {
                    type: 'http',
                    config: { url: 'https://api.com', method: 'GET' }
                }
            }
        ],
    };

    it('generates package.json with express', () => {
        const pkg = JSON.parse(templates.packageJson(sseSpell));
        expect(pkg.dependencies).toHaveProperty('express');
    });

    it('generates server code with Express and SSEServerTransport', () => {
        const code = templates.serverCode(sseSpell);
        expect(code).toContain("import express from 'express'");
        expect(code).toContain("import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'");
        expect(code).toContain("const app = express()");
        expect(code).toContain("app.get('/sse'");
    });
});
