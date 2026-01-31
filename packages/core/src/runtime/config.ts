/**
 * Spellbook Runtime: Server Configuration Schema
 * 
 * Zod schema for runtime configuration of generated MCP servers.
 * Enables environment-based config, validation at startup, and documentation.
 */

import { z } from 'zod';

// ============================================================================
// Configuration Schema
// ============================================================================

export const ServerConfigSchema = z.object({
    /** Server port (SSE transport only) */
    port: z.number().min(1).max(65535).default(3000),

    /** Logging level */
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    /** Health check configuration */
    healthCheck: z.object({
        /** Enable health endpoints */
        enabled: z.boolean().default(true),
        /** Health endpoint path */
        path: z.string().default('/health'),
        /** Ready endpoint path */
        readyPath: z.string().default('/ready'),
    }).default({}),

    /** Upstream HTTP configuration */
    upstream: z.object({
        /** Request timeout in ms */
        timeout: z.number().min(0).default(30000),
        /** Retry attempts for failed requests */
        retryAttempts: z.number().min(0).max(10).default(3),
        /** Base delay between retries in ms */
        retryDelay: z.number().min(0).default(1000),
    }).default({}),

    /** Memory limits */
    limits: z.object({
        /** Max memory usage before degraded status (bytes) */
        maxMemory: z.number().default(256 * 1024 * 1024), // 256MB
        /** Max response size (bytes) */
        maxResponseSize: z.number().default(10 * 1024 * 1024), // 10MB
    }).default({}),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Load configuration from environment or defaults.
 * Supports CONFIG env var as JSON string.
 */
export function loadConfig(overrides?: Partial<ServerConfig>): ServerConfig {
    const envConfig = process.env.CONFIG
        ? JSON.parse(process.env.CONFIG)
        : {};

    return ServerConfigSchema.parse({
        ...envConfig,
        ...overrides,
        // Individual env var overrides
        port: process.env.PORT ? parseInt(process.env.PORT) : undefined,
        logLevel: process.env.LOG_LEVEL,
    });
}
