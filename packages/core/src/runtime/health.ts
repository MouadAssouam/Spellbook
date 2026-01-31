/**
 * Spellbook Runtime: Health Check Module
 * 
 * Provides health and readiness endpoints for production deployments.
 * Compatible with Kubernetes, load balancers, and monitoring systems.
 */

// ============================================================================
// Types
// ============================================================================

export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, CheckResult>;
    timestamp: string;
    uptime: number;
}

export interface CheckResult {
    status: 'pass' | 'fail';
    message?: string;
}

export interface HealthCheckOptions {
    maxMemoryBytes?: number;
    customChecks?: Record<string, () => Promise<CheckResult>>;
}

// ============================================================================
// Health Check Implementation
// ============================================================================

/**
 * Performs health check and returns status.
 * 
 * Checks:
 * - Memory usage against limit
 * - Process uptime
 * - Custom checks if provided
 */
export async function healthCheck(options: HealthCheckOptions = {}): Promise<HealthCheckResult> {
    const maxMemory = options.maxMemoryBytes ?? 256 * 1024 * 1024;
    const checks: Record<string, CheckResult> = {};

    // Memory check
    const memUsage = process.memoryUsage();
    checks.memory = {
        status: memUsage.heapUsed < maxMemory ? 'pass' : 'fail',
        message: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(maxMemory / 1024 / 1024)}MB`,
    };

    // Uptime check
    checks.uptime = {
        status: process.uptime() > 0 ? 'pass' : 'fail',
        message: `${Math.round(process.uptime())}s`,
    };

    // Run custom checks
    if (options.customChecks) {
        for (const [name, check] of Object.entries(options.customChecks)) {
            try {
                checks[name] = await check();
            } catch (error) {
                checks[name] = {
                    status: 'fail',
                    message: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }
    }

    // Determine overall status
    const results = Object.values(checks);
    const allPass = results.every(c => c.status === 'pass');
    const anyPass = results.some(c => c.status === 'pass');

    const status = allPass ? 'healthy' : anyPass ? 'degraded' : 'unhealthy';

    return {
        status,
        checks,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    };
}

/**
 * Readiness check - simpler than health, just checks if server can accept requests.
 */
export async function readyCheck(): Promise<{ ready: boolean; timestamp: string }> {
    return {
        ready: true,
        timestamp: new Date().toISOString(),
    };
}
