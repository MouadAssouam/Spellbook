/**
 * API Watcher Tests
 * 
 * Tests for schema diffing and change detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    diffSchemas,
    checkForChanges,
    WatchManager,
    getWatchManager,
    resetWatchManager,
    type WatchConfig
} from './api-watcher.js';
import type { JSONSchema } from './schema-inference.js';

describe('diffSchemas', () => {
    const spellId = 'test-spell';
    const toolName = 'test-tool';

    it('should detect no changes for identical schemas', () => {
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'integer' }
            }
        };

        const changes = diffSchemas(schema, schema, spellId, toolName);
        expect(changes).toHaveLength(0);
    });

    it('should detect added fields', () => {
        const before: JSONSchema = {
            type: 'object',
            properties: {
                name: { type: 'string' }
            }
        };
        const after: JSONSchema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'integer' }
            }
        };

        const changes = diffSchemas(before, after, spellId, toolName);

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            type: 'field_added',
            path: 'age',
            before: 'undefined',
            after: 'integer'
        });
    });

    it('should detect removed fields', () => {
        const before: JSONSchema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'integer' }
            }
        };
        const after: JSONSchema = {
            type: 'object',
            properties: {
                name: { type: 'string' }
            }
        };

        const changes = diffSchemas(before, after, spellId, toolName);

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            type: 'field_removed',
            path: 'age',
            before: 'integer',
            after: 'undefined'
        });
    });

    it('should detect type changes', () => {
        const before: JSONSchema = {
            type: 'object',
            properties: {
                age: { type: 'string' }
            }
        };
        const after: JSONSchema = {
            type: 'object',
            properties: {
                age: { type: 'integer' }
            }
        };

        const changes = diffSchemas(before, after, spellId, toolName);

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            type: 'type_changed',
            path: 'age',
            before: 'string',
            after: 'integer'
        });
    });

    it('should detect root type changes', () => {
        const before: JSONSchema = { type: 'object' };
        const after: JSONSchema = { type: 'array' };

        const changes = diffSchemas(before, after, spellId, toolName);

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            type: 'type_changed',
            path: 'root',
            before: 'object',
            after: 'array'
        });
    });

    it('should detect nested field changes', () => {
        const before: JSONSchema = {
            type: 'object',
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    }
                }
            }
        };
        const after: JSONSchema = {
            type: 'object',
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        email: { type: 'string' }
                    }
                }
            }
        };

        const changes = diffSchemas(before, after, spellId, toolName);

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            type: 'field_added',
            path: 'user.email',
            before: 'undefined',
            after: 'string'
        });
    });

    it('should detect array item type changes', () => {
        const before: JSONSchema = {
            type: 'array',
            items: { type: 'string' }
        };
        const after: JSONSchema = {
            type: 'array',
            items: { type: 'object' }
        };

        const changes = diffSchemas(before, after, spellId, toolName);

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            type: 'type_changed',
            path: 'items',
            before: 'string',
            after: 'object'
        });
    });

    it('should detect multiple changes', () => {
        const before: JSONSchema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'string' },
                removed: { type: 'boolean' }
            }
        };
        const after: JSONSchema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'integer' },
                added: { type: 'string' }
            }
        };

        const changes = diffSchemas(before, after, spellId, toolName);

        expect(changes).toHaveLength(3);
        expect(changes.map(c => c.type).sort()).toEqual([
            'field_added',
            'field_removed',
            'type_changed'
        ]);
    });
});

describe('WatchManager', () => {
    let manager: WatchManager;

    beforeEach(() => {
        resetWatchManager();
        manager = getWatchManager();
        vi.useFakeTimers();
    });

    afterEach(() => {
        manager.stopAll();
        vi.useRealTimers();
    });

    it('should track watched configs', () => {
        const config: WatchConfig = {
            spellId: 'spell-1',
            toolName: 'tool-1',
            testUrl: 'https://api.example.com/test',
            method: 'GET',
            testValues: {},
            intervalMs: 60000,
            lastSchema: { type: 'object' },
            lastChecked: new Date()
        };

        manager.startWatching(config);

        expect(manager.isWatching('spell-1', 'tool-1')).toBe(true);
        expect(manager.isWatching('spell-1', 'tool-2')).toBe(false);
        expect(manager.getWatchedConfigs()).toHaveLength(1);
    });

    it('should stop watching a specific tool', () => {
        const config: WatchConfig = {
            spellId: 'spell-1',
            toolName: 'tool-1',
            testUrl: 'https://api.example.com/test',
            method: 'GET',
            testValues: {},
            intervalMs: 60000,
            lastSchema: { type: 'object' },
            lastChecked: new Date()
        };

        manager.startWatching(config);
        expect(manager.isWatching('spell-1', 'tool-1')).toBe(true);

        manager.stopWatching('spell-1', 'tool-1');
        expect(manager.isWatching('spell-1', 'tool-1')).toBe(false);
    });

    it('should stop all watches', () => {
        const config1: WatchConfig = {
            spellId: 'spell-1',
            toolName: 'tool-1',
            testUrl: 'https://api.example.com/test1',
            method: 'GET',
            testValues: {},
            intervalMs: 60000,
            lastSchema: { type: 'object' },
            lastChecked: new Date()
        };

        const config2: WatchConfig = {
            spellId: 'spell-2',
            toolName: 'tool-2',
            testUrl: 'https://api.example.com/test2',
            method: 'GET',
            testValues: {},
            intervalMs: 60000,
            lastSchema: { type: 'object' },
            lastChecked: new Date()
        };

        manager.startWatching(config1);
        manager.startWatching(config2);
        expect(manager.getWatchedConfigs()).toHaveLength(2);

        manager.stopAll();
        expect(manager.getWatchedConfigs()).toHaveLength(0);
    });

    it('should replace existing watch for same tool', () => {
        const config1: WatchConfig = {
            spellId: 'spell-1',
            toolName: 'tool-1',
            testUrl: 'https://api.example.com/test1',
            method: 'GET',
            testValues: {},
            intervalMs: 60000,
            lastSchema: { type: 'object' },
            lastChecked: new Date()
        };

        const config2: WatchConfig = {
            ...config1,
            intervalMs: 30000 // Different interval
        };

        manager.startWatching(config1);
        manager.startWatching(config2);

        // Should still be only one watch
        expect(manager.getWatchedConfigs()).toHaveLength(1);
        expect(manager.getWatchedConfigs()[0].intervalMs).toBe(30000);
    });
});

describe('checkForChanges', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should detect changes when API response changes', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            headers: {
                get: () => 'application/json'
            },
            json: async () => ({ name: 'test', newField: true })
        };

        global.fetch = vi.fn().mockResolvedValue(mockResponse);

        const config: WatchConfig = {
            spellId: 'spell-1',
            toolName: 'tool-1',
            testUrl: 'https://api.example.com/test',
            method: 'GET',
            testValues: {},
            intervalMs: 60000,
            lastSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                },
                required: ['name']
            },
            lastChecked: new Date()
        };

        const result = await checkForChanges(config);

        expect(result.success).toBe(true);
        expect(result.changes.length).toBeGreaterThan(0);
        expect(result.changes[0]).toMatchObject({
            type: 'field_added',
            path: 'newField'
        });
    });

    it('should handle non-JSON responses', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            headers: {
                get: () => 'text/html'
            }
        };

        global.fetch = vi.fn().mockResolvedValue(mockResponse);

        const config: WatchConfig = {
            spellId: 'spell-1',
            toolName: 'tool-1',
            testUrl: 'https://api.example.com/test',
            method: 'GET',
            testValues: {},
            intervalMs: 60000,
            lastSchema: { type: 'object' },
            lastChecked: new Date()
        };

        const result = await checkForChanges(config);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not JSON');
    });

    it('should handle request errors', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const config: WatchConfig = {
            spellId: 'spell-1',
            toolName: 'tool-1',
            testUrl: 'https://api.example.com/test',
            method: 'GET',
            testValues: {},
            intervalMs: 60000,
            lastSchema: { type: 'object' },
            lastChecked: new Date()
        };

        const result = await checkForChanges(config);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
    });

    it('should handle first check with null lastSchema', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            headers: {
                get: () => 'application/json'
            },
            json: async () => ({ name: 'test', age: 25 })
        };

        global.fetch = vi.fn().mockResolvedValue(mockResponse);

        const config: WatchConfig = {
            spellId: 'spell-1',
            toolName: 'tool-1',
            testUrl: 'https://api.example.com/test',
            method: 'GET',
            testValues: {},
            intervalMs: 60000,
            lastSchema: null, // First check - no previous schema
            lastChecked: new Date()
        };

        const result = await checkForChanges(config);

        expect(result.success).toBe(true);
        expect(result.changes).toHaveLength(0); // No changes on first run
        expect(result.newSchema).toBeDefined();
        expect(result.newSchema?.type).toBe('object');
    });
});
