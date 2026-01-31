/**
 * Spellbook Runtime: Telemetry Module
 * 
 * Structured logging and telemetry for generated MCP servers.
 * Provides consistent event format for debugging and monitoring.
 */

// ============================================================================
// Types
// ============================================================================

export interface TelemetryEvent {
    /** ISO timestamp */
    timestamp: string;
    /** Log level */
    level: 'debug' | 'info' | 'warn' | 'error';
    /** Event name */
    event: string;
    /** Tool name if applicable */
    tool?: string;
    /** Duration in milliseconds */
    duration_ms?: number;
    /** Request/trace ID for correlation */
    requestId?: string;
    /** Error details */
    error?: {
        type: string;
        message: string;
        stack?: string;
    };
    /** Additional context */
    context?: Record<string, unknown>;
}

export type LogLevel = TelemetryEvent['level'];

export interface TelemetryOptions {
    level?: LogLevel;
    requestId?: string;
}

// ============================================================================
// Log Level Priorities
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// ============================================================================
// Telemetry Implementation
// ============================================================================

let currentLevel: LogLevel = 'info';

/**
 * Set the minimum log level.
 */
export function setLogLevel(level: LogLevel): void {
    currentLevel = level;
}

/**
 * Check if a level should be logged.
 */
function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Emit a telemetry event.
 */
export function emit(event: Omit<TelemetryEvent, 'timestamp'>): void {
    if (!shouldLog(event.level)) return;

    const fullEvent: TelemetryEvent = {
        ...event,
        timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(fullEvent));
}

/**
 * Create a scoped logger for a specific tool/context.
 */
export function createLogger(tool: string, options: TelemetryOptions = {}) {
    return {
        debug: (event: string, context?: Record<string, unknown>) =>
            emit({ level: 'debug', event, tool, context, requestId: options.requestId }),

        info: (event: string, context?: Record<string, unknown>) =>
            emit({ level: 'info', event, tool, context, requestId: options.requestId }),

        warn: (event: string, context?: Record<string, unknown>) =>
            emit({ level: 'warn', event, tool, context, requestId: options.requestId }),

        error: (event: string, error: Error, context?: Record<string, unknown>) =>
            emit({
                level: 'error',
                event,
                tool,
                context,
                requestId: options.requestId,
                error: {
                    type: error.constructor.name,
                    message: error.message,
                    stack: error.stack,
                },
            }),

        /** Time an async operation */
        async time<T>(event: string, fn: () => Promise<T>): Promise<T> {
            const start = Date.now();
            try {
                const result = await fn();
                emit({
                    level: 'info',
                    event,
                    tool,
                    duration_ms: Date.now() - start,
                    requestId: options.requestId,
                });
                return result;
            } catch (err) {
                emit({
                    level: 'error',
                    event,
                    tool,
                    duration_ms: Date.now() - start,
                    requestId: options.requestId,
                    error: {
                        type: (err as Error).constructor.name,
                        message: (err as Error).message,
                    },
                });
                throw err;
            }
        },
    };
}
