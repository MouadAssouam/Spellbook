/**
 * Spellbook Runtime: Resilience Patterns
 * 
 * Circuit breaker and retry utilities for production reliability.
 */

// ============================================================================
// Circuit Breaker
// ============================================================================

export interface CircuitBreakerOptions {
    /** Failures before opening circuit */
    threshold: number;
    /** Milliseconds to stay open before half-open */
    timeout: number;
    /** Attempts allowed in half-open state */
    halfOpenAttempts?: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
    private failures = 0;
    private successes = 0;
    private lastFailureTime?: number;
    private state: CircuitState = 'closed';

    constructor(private options: CircuitBreakerOptions) { }

    getState(): CircuitState {
        return this.state;
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Check if circuit should transition from open to half-open
        if (this.state === 'open') {
            if (Date.now() - (this.lastFailureTime ?? 0) > this.options.timeout) {
                this.state = 'half-open';
                this.successes = 0;
            } else {
                throw new CircuitOpenError('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;

        if (this.state === 'half-open') {
            this.successes++;
            const halfOpenAttempts = this.options.halfOpenAttempts ?? 3;
            if (this.successes >= halfOpenAttempts) {
                this.state = 'closed';
            }
        }
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.options.threshold) {
            this.state = 'open';
        }
    }

    /** Reset the circuit breaker to closed state */
    reset(): void {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = undefined;
    }
}

export class CircuitOpenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CircuitOpenError';
    }
}

// ============================================================================
// Retry with Exponential Backoff + Jitter
// ============================================================================

export interface RetryOptions {
    /** Maximum number of attempts */
    maxAttempts: number;
    /** Base delay in milliseconds */
    baseDelay: number;
    /** Maximum delay in milliseconds */
    maxDelay: number;
    /** Jitter factor (0-1), adds randomness to prevent thundering herd */
    jitter?: number;
    /** Function to determine if error is retryable */
    isRetryable?: (error: Error) => boolean;
    /** Callback on each retry */
    onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Retry a function with exponential backoff and jitter.
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions
): Promise<T> {
    const {
        maxAttempts,
        baseDelay,
        maxDelay,
        jitter = 0.1,
        isRetryable = () => true,
        onRetry,
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            // Check if we should retry
            if (attempt >= maxAttempts || !isRetryable(lastError)) {
                throw lastError;
            }

            // Calculate delay with exponential backoff
            const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
            const cappedDelay = Math.min(exponentialDelay, maxDelay);

            // Add jitter to prevent thundering herd
            const jitterAmount = cappedDelay * jitter * Math.random();
            const delay = cappedDelay + jitterAmount;

            if (onRetry) {
                onRetry(attempt, lastError, delay);
            }

            await sleep(delay);
        }
    }

    throw lastError!;
}

/**
 * Create a retryable version of a function.
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: RetryOptions
): T {
    return ((...args: Parameters<T>) => retry(() => fn(...args), options)) as T;
}

// ============================================================================
// Timeout Wrapper
// ============================================================================

export class TimeoutError extends Error {
    constructor(ms: number) {
        super(`Operation timed out after ${ms}ms`);
        this.name = 'TimeoutError';
    }
}

/**
 * Wrap a promise with a timeout.
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    ms: number
): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new TimeoutError(ms)), ms);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId!);
    }
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// HTTP Retry Configuration
// ============================================================================

/**
 * Default retry options for HTTP requests.
 */
export const httpRetryDefaults: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    jitter: 0.1,
    isRetryable: (error: Error) => {
        // Retry on network errors and 5xx responses
        if (error.message.includes('fetch failed')) return true;
        if (error.message.includes('ECONNREFUSED')) return true;
        if (error.message.includes('ETIMEDOUT')) return true;
        if (error.message.includes('HTTP 5')) return true;
        if (error.message.includes('HTTP 429')) return true; // Rate limited
        return false;
    },
};
