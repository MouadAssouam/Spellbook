/**
 * Tests for New Runtime Modules (Phase 10/10)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Tracing
import { Tracer, initTracer, getTracer, withTracing } from './tracing.js';

// OAuth
import {
    TokenManager,
    createMemoryStorage,
    createEnvStorage,
} from './oauth.js';

// Secret Rotation
import {
    SecretRotator,
    SecretGenerators,
} from './secret-rotation.js';

// Config Versioning
import {
    ConfigManager,
    ABTester,
    createMemoryConfigStorage,
} from './config-versioning.js';

// Terraform
import { generateTerraformModule } from './terraform.js';

// WebSocket
import { generateWebSocketServer, generateWebSocketClient } from './websocket.js';

// ============================================================================
// Tracing Tests
// ============================================================================

describe('Tracing', () => {
    it('creates spans with context', () => {
        const tracer = new Tracer({ serviceName: 'test-service' });
        const span = tracer.startSpan('test-span');

        expect(span.name).toBe('test-span');
        expect(span.context.traceId).toHaveLength(32);
        expect(span.context.spanId).toHaveLength(16);

        span.end();
    });

    it('traces async functions', async () => {
        const tracer = new Tracer({ serviceName: 'test-service' });

        const result = await tracer.trace('async-op', async (span) => {
            span.setAttribute('custom', 'value');
            return 42;
        });

        expect(result).toBe(42);
    });

    it('records exceptions', async () => {
        const tracer = new Tracer({ serviceName: 'test-service' });

        await expect(
            tracer.trace('failing', async () => {
                throw new Error('test error');
            })
        ).rejects.toThrow('test error');
    });

    it('exports to console', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const tracer = new Tracer({ serviceName: 'test', exporter: 'console', sampleRate: 1 });

        const span = tracer.startSpan('test');
        span.end();

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('global tracer initialization', () => {
        const tracer = initTracer({ serviceName: 'global-test' });
        expect(getTracer()).toBe(tracer);
    });

    it('withTracing wrapper', async () => {
        initTracer({ serviceName: 'wrapper-test' });

        const fn = withTracing('my-tool', async (input: number) => input * 2);
        const result = await fn(21);

        expect(result).toBe(42);
    });
});

// ============================================================================
// OAuth Tests
// ============================================================================

describe('OAuth', () => {
    describe('Memory Storage', () => {
        it('stores and retrieves tokens', async () => {
            const storage = createMemoryStorage();

            await storage.set({ accessToken: 'token123' });
            const tokens = await storage.get();

            expect(tokens?.accessToken).toBe('token123');
        });

        it('clears tokens', async () => {
            const storage = createMemoryStorage();

            await storage.set({ accessToken: 'token123' });
            await storage.clear();

            expect(await storage.get()).toBeNull();
        });
    });

    describe('Env Storage', () => {
        afterEach(() => {
            delete process.env.TEST_OAUTH_ACCESS_TOKEN;
            delete process.env.TEST_OAUTH_REFRESH_TOKEN;
            delete process.env.TEST_OAUTH_EXPIRES_AT;
        });

        it('reads from env', async () => {
            process.env.TEST_OAUTH_ACCESS_TOKEN = 'env-token';
            const storage = createEnvStorage('TEST_OAUTH_');

            const tokens = await storage.get();
            expect(tokens?.accessToken).toBe('env-token');
        });
    });

    describe('Token Manager', () => {
        it('throws when no tokens available', async () => {
            const manager = new TokenManager({
                config: { clientId: 'id', clientSecret: 'secret', tokenUrl: 'http://test' },
                storage: createMemoryStorage(),
            });

            await expect(manager.getAccessToken()).rejects.toThrow('No OAuth tokens');
        });

        it('returns token when available and not expired', async () => {
            const storage = createMemoryStorage();
            await storage.set({
                accessToken: 'valid-token',
                expiresAt: Date.now() + 3600000, // 1 hour
            });

            const manager = new TokenManager({
                config: { clientId: 'id', clientSecret: 'secret', tokenUrl: 'http://test' },
                storage,
            });

            const token = await manager.getAccessToken();
            expect(token).toBe('valid-token');
        });
    });
});

// ============================================================================
// Secret Rotation Tests
// ============================================================================

describe('Secret Rotation', () => {
    it('registers and rotates secrets', async () => {
        const rotator = new SecretRotator();
        let rotated = false;

        const provider = {
            name: 'test',
            get: async () => 'old-secret',
        };

        rotator.register({
            secretKey: 'API_KEY',
            intervalMs: 10000,
            provider,
            generator: async () => 'new-secret',
            onRotation: () => { rotated = true; },
        });

        const result = await rotator.rotate('API_KEY');

        expect(result.success).toBe(true);
        expect(rotated).toBe(true);

        rotator.stopAll();
    });

    it('tracks rotation history', async () => {
        const rotator = new SecretRotator();

        rotator.register({
            secretKey: 'KEY',
            intervalMs: 10000,
            provider: { name: 'test', get: async () => 'val' },
            generator: async () => 'new',
        });

        await rotator.rotate('KEY');
        await rotator.rotate('KEY');

        const history = rotator.getHistory('KEY');
        expect(history).toHaveLength(2);

        rotator.stopAll();
    });

    it('handles rotation failure', async () => {
        const rotator = new SecretRotator();
        let errorCaught = false;

        rotator.register({
            secretKey: 'FAIL',
            intervalMs: 10000,
            provider: { name: 'test', get: async () => 'val' },
            generator: async () => { throw new Error('gen failed'); },
            onError: () => { errorCaught = true; },
        });

        const result = await rotator.rotate('FAIL');

        expect(result.success).toBe(false);
        expect(errorCaught).toBe(true);

        rotator.stopAll();
    });

    describe('Secret Generators', () => {
        it('alphanumeric generates correct length', async () => {
            const gen = SecretGenerators.alphanumeric(16);
            const secret = await gen();
            expect(secret).toHaveLength(16);
        });

        it('uuid generates valid format', async () => {
            const gen = SecretGenerators.uuid();
            const secret = await gen();
            expect(secret).toMatch(/^[a-f0-9-]{36}$/);
        });
    });
});

// ============================================================================
// Config Versioning Tests
// ============================================================================

describe('Config Versioning', () => {
    it('tracks config versions', async () => {
        const manager = new ConfigManager({
            current: {
                version: 'v1',
                timestamp: Date.now(),
                config: { debug: false }
            },
        });

        const version = await manager.update({ debug: true });

        expect(version).toMatch(/^v\d{8}-[a-z0-9]{6}$/);
        expect(manager.get().debug).toBe(true);
    });

    it('rolls back to previous version', async () => {
        const manager = new ConfigManager({
            current: {
                version: 'v1',
                timestamp: Date.now(),
                config: { value: 1 }
            },
        });

        await manager.update({ value: 2 });
        await manager.update({ value: 3 });

        const rolled = await manager.rollback('v1');
        expect(rolled.value).toBe(1);
    });

    it('validates config before update', async () => {
        const manager = new ConfigManager({
            current: { version: 'v1', timestamp: Date.now(), config: { port: 3000 } },
            validate: (c) => c.port > 0 && c.port < 65536,
        });

        await expect(manager.update({ port: -1 })).rejects.toThrow('validation failed');
    });

    describe('A/B Testing', () => {
        it('assigns variants deterministically', () => {
            const tester = new ABTester<{ feature: boolean }>();

            tester.registerTest({
                name: 'feature-flag',
                variants: [
                    { name: 'control', config: { feature: false }, weight: 50 },
                    { name: 'treatment', config: { feature: true }, weight: 50 },
                ],
            });

            const v1 = tester.getVariant('feature-flag', 'user-123');
            const v2 = tester.getVariant('feature-flag', 'user-123');

            expect(v1).toBe(v2); // Same user gets same variant
        });

        it('applies config overrides', () => {
            const tester = new ABTester<{ color: string }>();

            tester.registerTest({
                name: 'color-test',
                variants: [
                    { name: 'blue', config: { color: 'blue' }, weight: 100 },
                ],
            });

            const config = tester.getConfig({ color: 'red' }, 'color-test', 'user-1');
            expect(config.color).toBe('blue');
        });
    });
});

// ============================================================================
// Terraform Tests
// ============================================================================

describe('Terraform Generator', () => {
    const spell = {
        id: 'test-id',
        name: 'test-api',
        description: 'Test API',
        transport: 'sse' as const,
        tools: [],
    };

    it('generates AWS ECS module', () => {
        const tf = generateTerraformModule(spell, {
            provider: 'aws',
            image: 'test:latest',
            region: 'us-east-1',
        });

        expect(tf).toContain('provider "aws"');
        expect(tf).toContain('aws_ecs_cluster');
        expect(tf).toContain('aws_ecs_service');
        expect(tf).toContain('aws_lb');
    });

    it('generates GCP Cloud Run module', () => {
        const tf = generateTerraformModule(spell, {
            provider: 'gcp',
            image: 'gcr.io/test:latest',
            region: 'us-central1',
        });

        expect(tf).toContain('provider "google"');
        expect(tf).toContain('google_cloud_run_v2_service');
        expect(tf).toContain('liveness_probe');
    });

    it('includes health checks', () => {
        const tf = generateTerraformModule(spell, {
            provider: 'aws',
            image: 'test:latest',
        });

        expect(tf).toContain('/health');
    });
});

// ============================================================================
// WebSocket Tests
// ============================================================================

describe('WebSocket Generator', () => {
    it('generates server code', () => {
        const server = generateWebSocketServer({ port: 3000 });

        expect(server).toContain('WebSocketServer');
        expect(server).toContain('/health');
        expect(server).toContain('/ready');
        expect(server).toContain('heartbeat');
    });

    it('generates client code', () => {
        const client = generateWebSocketClient();

        expect(client).toContain('MCPWebSocketClient');
        expect(client).toContain('listTools');
        expect(client).toContain('callTool');
        expect(client).toContain('reconnect');
    });

    it('respects custom options', () => {
        const server = generateWebSocketServer({
            port: 8080,
            path: '/mcp',
            heartbeatInterval: 60000,
            maxConnections: 50,
        });

        expect(server).toContain('8080');
        expect(server).toContain('/mcp');
        expect(server).toContain('60000');
        expect(server).toContain('50');
    });
});
