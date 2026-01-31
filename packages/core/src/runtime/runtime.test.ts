/**
 * Tests for Runtime Modules
 */

import { describe, it, expect, vi } from 'vitest';
import {
    ServerConfigSchema,
    loadConfig,
} from './config.js';
import {
    healthCheck,
    readyCheck,
} from './health.js';
import {
    emit,
    createLogger,
    setLogLevel,
} from './telemetry.js';
import {
    createEnvProvider,
    createCompositeProvider,
    createSecretProvider,
} from './secrets.js';
import {
    CircuitBreaker,
    CircuitOpenError,
    retry,
    withTimeout,
    TimeoutError,
} from './resilience.js';

// ============================================================================
// Config Tests
// ============================================================================

describe('ServerConfigSchema', () => {
    it('provides sensible defaults', () => {
        const config = ServerConfigSchema.parse({});

        expect(config.port).toBe(3000);
        expect(config.logLevel).toBe('info');
        expect(config.healthCheck.enabled).toBe(true);
        expect(config.upstream.timeout).toBe(30000);
    });

    it('validates port range', () => {
        expect(() => ServerConfigSchema.parse({ port: 0 })).toThrow();
        expect(() => ServerConfigSchema.parse({ port: 70000 })).toThrow();
        expect(() => ServerConfigSchema.parse({ port: 8080 })).not.toThrow();
    });

    it('validates log levels', () => {
        expect(() => ServerConfigSchema.parse({ logLevel: 'invalid' })).toThrow();
        expect(() => ServerConfigSchema.parse({ logLevel: 'debug' })).not.toThrow();
    });
});

// ============================================================================
// Health Check Tests
// ============================================================================

describe('Health Check', () => {
    it('returns healthy status', async () => {
        const result = await healthCheck();

        expect(result.status).toBe('healthy');
        expect(result.checks.memory.status).toBe('pass');
        expect(result.checks.uptime.status).toBe('pass');
        expect(result.timestamp).toBeDefined();
    });

    it('includes custom checks', async () => {
        const result = await healthCheck({
            customChecks: {
                database: async () => ({ status: 'pass', message: 'Connected' }),
            },
        });

        expect(result.checks.database.status).toBe('pass');
    });

    it('handles failing custom checks', async () => {
        const result = await healthCheck({
            customChecks: {
                failing: async () => { throw new Error('Connection failed'); },
            },
        });

        expect(result.checks.failing.status).toBe('fail');
        expect(result.checks.failing.message).toContain('Connection failed');
    });
});

describe('Ready Check', () => {
    it('returns ready status', async () => {
        const result = await readyCheck();

        expect(result.ready).toBe(true);
        expect(result.timestamp).toBeDefined();
    });
});

// ============================================================================
// Telemetry Tests
// ============================================================================

describe('Telemetry', () => {
    it('creates scoped logger', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        const logger = createLogger('test-tool');

        logger.info('test event', { key: 'value' });

        expect(consoleSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(output.level).toBe('info');
        expect(output.tool).toBe('test-tool');
        expect(output.event).toBe('test event');

        consoleSpy.mockRestore();
    });

    it('respects log level', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        setLogLevel('error');

        emit({ level: 'info', event: 'should not log' });
        expect(consoleSpy).not.toHaveBeenCalled();

        emit({ level: 'error', event: 'should log' });
        expect(consoleSpy).toHaveBeenCalled();

        setLogLevel('info'); // Reset
        consoleSpy.mockRestore();
    });
});

// ============================================================================
// Secret Provider Tests
// ============================================================================

describe('Secret Providers', () => {
    describe('EnvProvider', () => {
        it('reads from process.env', async () => {
            process.env.TEST_SECRET = 'secret-value';
            const provider = createEnvProvider();

            const value = await provider.get('TEST_SECRET');
            expect(value).toBe('secret-value');

            delete process.env.TEST_SECRET;
        });

        it('supports prefix', async () => {
            process.env.APP_API_KEY = 'key123';
            const provider = createEnvProvider({ prefix: 'APP_' });

            const value = await provider.get('API_KEY');
            expect(value).toBe('key123');

            delete process.env.APP_API_KEY;
        });
    });

    describe('CompositeProvider', () => {
        it('falls back through providers', async () => {
            const provider1 = createEnvProvider({ prefix: 'MISSING_' });
            process.env.FALLBACK_KEY = 'found';
            const provider2 = createEnvProvider({ prefix: 'FALLBACK_' });

            const composite = createCompositeProvider([provider1, provider2]);
            const value = await composite.get('KEY');

            expect(value).toBe('found');
            delete process.env.FALLBACK_KEY;
        });
    });

    describe('createSecretProvider', () => {
        it('creates env provider', () => {
            const provider = createSecretProvider({ type: 'env' });
            expect(provider.name).toBe('env');
        });

        it('throws for AWS without region', () => {
            expect(() => createSecretProvider({ type: 'aws' })).toThrow('region');
        });

        it('throws for GCP without projectId', () => {
            expect(() => createSecretProvider({ type: 'gcp' })).toThrow('projectId');
        });
    });
});

// ============================================================================
// Resilience Tests
// ============================================================================

describe('CircuitBreaker', () => {
    it('starts in closed state', () => {
        const breaker = new CircuitBreaker({ threshold: 3, timeout: 1000 });
        expect(breaker.getState()).toBe('closed');
    });

    it('opens after threshold failures', async () => {
        const breaker = new CircuitBreaker({ threshold: 2, timeout: 1000 });

        for (let i = 0; i < 2; i++) {
            try {
                await breaker.execute(async () => { throw new Error('fail'); });
            } catch { }
        }

        expect(breaker.getState()).toBe('open');
    });

    it('throws CircuitOpenError when open', async () => {
        const breaker = new CircuitBreaker({ threshold: 1, timeout: 1000 });

        try {
            await breaker.execute(async () => { throw new Error('fail'); });
        } catch { }

        await expect(breaker.execute(async () => 'success')).rejects.toThrow(CircuitOpenError);
    });

    it('resets on success', async () => {
        const breaker = new CircuitBreaker({ threshold: 3, timeout: 1000 });

        // One failure
        try {
            await breaker.execute(async () => { throw new Error('fail'); });
        } catch { }

        // Then success
        await breaker.execute(async () => 'ok');

        // Should still be closed, counter reset
        expect(breaker.getState()).toBe('closed');
    });
});

describe('Retry', () => {
    it('retries on failure', async () => {
        let attempts = 0;

        const result = await retry(
            async () => {
                attempts++;
                if (attempts < 3) throw new Error('fail');
                return 'success';
            },
            { maxAttempts: 5, baseDelay: 10, maxDelay: 100 }
        );

        expect(result).toBe('success');
        expect(attempts).toBe(3);
    });

    it('gives up after max attempts', async () => {
        let attempts = 0;

        await expect(
            retry(
                async () => { attempts++; throw new Error('always fails'); },
                { maxAttempts: 3, baseDelay: 10, maxDelay: 100 }
            )
        ).rejects.toThrow('always fails');

        expect(attempts).toBe(3);
    });

    it('respects isRetryable', async () => {
        let attempts = 0;

        await expect(
            retry(
                async () => { attempts++; throw new Error('not retryable'); },
                {
                    maxAttempts: 5,
                    baseDelay: 10,
                    maxDelay: 100,
                    isRetryable: () => false,
                }
            )
        ).rejects.toThrow();

        expect(attempts).toBe(1);
    });
});

describe('withTimeout', () => {
    it('resolves fast promises', async () => {
        const result = await withTimeout(Promise.resolve('fast'), 1000);
        expect(result).toBe('fast');
    });

    it('rejects slow promises', async () => {
        const slow = new Promise(resolve => setTimeout(() => resolve('slow'), 500));
        await expect(withTimeout(slow, 50)).rejects.toThrow(TimeoutError);
    });
});
