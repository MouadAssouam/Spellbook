/**
 * Tests for Magic Auto-Generate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { magicFromUrl } from './magic.js';

describe('magicFromUrl', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('tool name generation', () => {
        it('generates name from simple URL', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ({ id: 1, name: 'test' })
            } as Response);

            const result = await magicFromUrl('https://api.example.com/users');

            expect(result.success).toBe(true);
            expect(result.spell?.name).toBe('get-users');
        });

        it('generates name from URL with placeholders', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ([{ id: 1 }])
            } as Response);

            const result = await magicFromUrl('https://api.github.com/repos/{{owner}}/{{repo}}/issues');

            expect(result.success).toBe(true);
            expect(result.spell?.name).toMatch(/issues/);
        });

        it('uses correct verb for POST', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 201,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ({ id: 1 })
            } as Response);

            const result = await magicFromUrl('https://api.example.com/users', { method: 'POST' });

            expect(result.spell?.name).toBe('create-users');
            expect(result.spell?.tool.method).toBe('POST');
        });

        it('uses correct verb for DELETE', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 204,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ({})
            } as Response);

            const result = await magicFromUrl('https://api.example.com/users/{{id}}', { method: 'DELETE' });

            expect(result.spell?.name).toBe('delete-users');
        });
    });

    describe('parameter extraction', () => {
        it('extracts URL placeholders as parameters', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ({ data: 'test' })
            } as Response);

            const result = await magicFromUrl('https://api.github.com/repos/{{owner}}/{{repo}}/issues');

            expect(result.spell?.tool.parameters).toEqual([
                { name: 'owner', type: 'string', required: true },
                { name: 'repo', type: 'string', required: true }
            ]);
        });

        it('handles URLs without placeholders', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ({ data: 'test' })
            } as Response);

            const result = await magicFromUrl('https://api.example.com/status');

            expect(result.spell?.tool.parameters).toEqual([]);
        });
    });

    describe('schema inference', () => {
        it('infers schema from JSON response', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ({ id: 1, name: 'test', active: true })
            } as Response);

            const result = await magicFromUrl('https://api.example.com/user');

            expect(result.spell?.tool.outputSchema).toEqual({
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    active: { type: 'boolean' }
                },
                required: ['id', 'name', 'active']
            });
        });

        it('infers array schema', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ([{ id: 1 }, { id: 2 }])
            } as Response);

            const result = await magicFromUrl('https://api.example.com/users');

            expect(result.spell?.tool.outputSchema.type).toBe('array');
        });
    });

    describe('auth detection', () => {
        it('detects auth requirement on 401', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: false,
                status: 401,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ({ error: 'Unauthorized' })
            } as Response);

            const result = await magicFromUrl('https://api.example.com/private');

            expect(result.success).toBe(true);
            expect(result.spell?.suggestedAuth).toBeDefined();
            expect(result.spell?.suggestedAuth?.type).toBe('bearer');
            expect(result.warnings).toBeDefined();
            expect(result.warnings?.[0]).toContain('authentication');
        });

        it('detects auth requirement on 403', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: false,
                status: 403,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ({ error: 'Forbidden' })
            } as Response);

            const result = await magicFromUrl('https://api.example.com/admin');

            expect(result.spell?.suggestedAuth).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('handles network errors', async () => {
            vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

            const result = await magicFromUrl('https://api.example.com/data');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Network error');
        });

        it('handles timeout', async () => {
            vi.mocked(fetch).mockImplementation(() => new Promise((_, reject) => {
                const error = new Error('Aborted');
                error.name = 'AbortError';
                setTimeout(() => reject(error), 50);
            }));

            const result = await magicFromUrl('https://api.example.com/slow', { timeout: 10 });

            expect(result.success).toBe(false);
            expect(result.error).toContain('timed out');
        });

        it('handles invalid URL', async () => {
            const result = await magicFromUrl('not-a-valid-url');

            expect(result.success).toBe(false);
        });
    });

    describe('test value generation', () => {
        it('uses provided test values', async () => {
            let capturedUrl = '';
            vi.mocked(fetch).mockImplementation(async (url) => {
                capturedUrl = url as string;
                return {
                    ok: true,
                    status: 200,
                    headers: new Map([['content-type', 'application/json']]) as any,
                    json: async () => ({ data: 'test' })
                } as Response;
            });

            await magicFromUrl('https://api.github.com/users/{{username}}', {
                testValues: { username: 'octocat' }
            });

            expect(capturedUrl).toBe('https://api.github.com/users/octocat');
        });

        it('uses smart defaults for common params', async () => {
            let capturedUrl = '';
            vi.mocked(fetch).mockImplementation(async (url) => {
                capturedUrl = url as string;
                return {
                    ok: true,
                    status: 200,
                    headers: new Map([['content-type', 'application/json']]) as any,
                    json: async () => ({ data: 'test' })
                } as Response;
            });

            await magicFromUrl('https://api.github.com/users/{{username}}');

            // Should use 'octocat' as smart default for username
            expect(capturedUrl).toBe('https://api.github.com/users/octocat');
        });
    });

    describe('description generation', () => {
        it('generates description with required length', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ({ id: 1 })
            } as Response);

            const result = await magicFromUrl('https://api.github.com/users');

            expect(result.spell?.tool.description.length).toBeGreaterThanOrEqual(100);
            expect(result.spell?.description.length).toBeGreaterThanOrEqual(100);
        });

        it('includes "Verified working" for successful responses', async () => {
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]) as any,
                json: async () => ({ id: 1 })
            } as Response);

            const result = await magicFromUrl('https://api.example.com/data');

            expect(result.spell?.tool.description).toContain('Verified working');
        });
    });
});
