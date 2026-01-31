/**
 * Spellbook Runtime: Dashboard Module
 *
 * Generates an HTML dashboard for monitoring generated MCP servers.
 * Displays metrics, health status, circuit breaker state, and recent telemetry.
 */

export interface DashboardData {
    serverName: string;
    serverVersion: string;
    uptime: number;
    health: {
        status: 'healthy' | 'degraded' | 'unhealthy';
        checks: Record<string, { status: string; message: string }>;
    };
    metrics: {
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        avgLatency: number;
        errorRate: number;
    };
    circuitBreaker?: {
        state: 'closed' | 'open' | 'half-open';
        failures: number;
        lastFailureTime?: string;
    };
    recentLogs: Array<{
        timestamp: string;
        level: string;
        event: string;
        tool?: string;
    }>;
}

/**
 * Generates the HTML dashboard content.
 */
export function generateDashboardHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spellbook MCP Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 24px;
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3);
        }

        .header h1 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .header p {
            color: rgba(255, 255, 255, 0.8);
            font-size: 14px;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 24px;
        }

        .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 20px;
            transition: border-color 0.2s;
        }

        .card:hover {
            border-color: #8b5cf6;
        }

        .card-title {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #94a3b8;
            margin-bottom: 12px;
        }

        .card-value {
            font-size: 32px;
            font-weight: 700;
            color: #f1f5f9;
        }

        .card-subtitle {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
        }

        .status-healthy { color: #10b981; }
        .status-degraded { color: #f59e0b; }
        .status-unhealthy { color: #ef4444; }

        .logs-section {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 20px;
        }

        .logs-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .logs-title {
            font-size: 16px;
            font-weight: 600;
        }

        .log-entry {
            display: grid;
            grid-template-columns: 150px 80px 1fr;
            gap: 12px;
            padding: 8px 0;
            border-bottom: 1px solid #334155;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
            font-size: 12px;
        }

        .log-entry:last-child {
            border-bottom: none;
        }

        .log-timestamp { color: #64748b; }
        .log-level { color: #94a3b8; }
        .log-level.error { color: #ef4444; }
        .log-level.warn { color: #f59e0b; }
        .log-level.info { color: #3b82f6; }
        .log-event { color: #f1f5f9; }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .badge-success { background: rgba(16, 185, 129, 0.2); color: #10b981; }
        .badge-warning { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
        .badge-error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

        .refresh-info {
            text-align: center;
            padding: 16px;
            color: #64748b;
            font-size: 12px;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .loading {
            animation: pulse 1.5s ease-in-out infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 id="server-name">Loading...</h1>
            <p id="server-info">Fetching server information...</p>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-title">Status</div>
                <div class="card-value" id="health-status">
                    <span class="loading">●</span>
                </div>
                <div class="card-subtitle" id="health-checks">Checking health...</div>
            </div>

            <div class="card">
                <div class="card-title">Total Requests</div>
                <div class="card-value" id="total-requests">-</div>
                <div class="card-subtitle" id="success-rate">Success rate: -</div>
            </div>

            <div class="card">
                <div class="card-title">Avg Latency</div>
                <div class="card-value" id="avg-latency">-<span style="font-size: 16px; color: #64748b;">ms</span></div>
                <div class="card-subtitle" id="p95-latency">P95: -</div>
            </div>

            <div class="card">
                <div class="card-title">Error Rate</div>
                <div class="card-value" id="error-rate">-<span style="font-size: 16px; color: #64748b;">%</span></div>
                <div class="card-subtitle" id="failed-requests">Failed: -</div>
            </div>

            <div class="card">
                <div class="card-title">Uptime</div>
                <div class="card-value" id="uptime">-</div>
                <div class="card-subtitle">Since server started</div>
            </div>

            <div class="card">
                <div class="card-title">Circuit Breaker</div>
                <div class="card-value" id="circuit-state">
                    <span class="loading">●</span>
                </div>
                <div class="card-subtitle" id="circuit-info">Checking...</div>
            </div>
        </div>

        <div class="logs-section">
            <div class="logs-header">
                <div class="logs-title">Recent Activity</div>
                <span class="badge badge-success" id="auto-refresh">Auto-refresh: ON</span>
            </div>
            <div id="logs-container">
                <div style="text-align: center; padding: 40px; color: #64748b;">
                    Loading logs...
                </div>
            </div>
        </div>

        <div class="refresh-info">
            Dashboard auto-refreshes every 5 seconds • Last updated: <span id="last-update">-</span>
        </div>
    </div>

    <script>
        let dashboardData = null;

        async function fetchDashboardData() {
            try {
                const response = await fetch('/_spellbook/metrics');
                if (!response.ok) throw new Error('Failed to fetch metrics');
                dashboardData = await response.json();
                updateUI();
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
                document.getElementById('server-info').textContent = 'Error: Could not connect to server';
            }
        }

        function formatUptime(seconds) {
            if (seconds < 60) return Math.round(seconds) + 's';
            if (seconds < 3600) return Math.round(seconds / 60) + 'm';
            if (seconds < 86400) return Math.round(seconds / 3600) + 'h';
            return Math.round(seconds / 86400) + 'd';
        }

        function updateUI() {
            if (!dashboardData) return;

            const data = dashboardData;

            // Header
            document.getElementById('server-name').textContent = data.serverName;
            document.getElementById('server-info').textContent = 'Version ' + data.serverVersion + ' • Spellbook MCP Server';

            // Health
            const healthEl = document.getElementById('health-status');
            healthEl.innerHTML = '<span class="status-' + data.health.status + '">●</span> ' + data.health.status.toUpperCase();

            const checks = Object.entries(data.health.checks);
            const passedChecks = checks.filter(([, c]) => c.status === 'pass').length;
            document.getElementById('health-checks').textContent = 'Checks: ' + passedChecks + '/' + checks.length + ' passing';

            // Metrics
            document.getElementById('total-requests').textContent = data.metrics.totalRequests.toLocaleString();
            const successRate = data.metrics.totalRequests > 0
                ? ((data.metrics.successfulRequests / data.metrics.totalRequests) * 100).toFixed(1)
                : '100';
            document.getElementById('success-rate').textContent = 'Success rate: ' + successRate + '%';

            document.getElementById('avg-latency').innerHTML = Math.round(data.metrics.avgLatency) + '<span style="font-size: 16px; color: #64748b;">ms</span>';
            document.getElementById('failed-requests').textContent = 'Failed: ' + data.metrics.failedRequests;

            const errorRate = data.metrics.errorRate.toFixed(2);
            document.getElementById('error-rate').innerHTML = errorRate + '<span style="font-size: 16px; color: #64748b;">%</span>';

            document.getElementById('uptime').textContent = formatUptime(data.uptime);

            // Circuit Breaker
            if (data.circuitBreaker) {
                const stateEl = document.getElementById('circuit-state');
                const stateColors = { closed: '#10b981', open: '#ef4444', 'half-open': '#f59e0b' };
                stateEl.innerHTML = '<span style="color: ' + stateColors[data.circuitBreaker.state] + '">●</span> ' + data.circuitBreaker.state.toUpperCase();
                document.getElementById('circuit-info').textContent = 'Failures: ' + data.circuitBreaker.failures;
            } else {
                document.getElementById('circuit-state').textContent = 'N/A';
                document.getElementById('circuit-info').textContent = 'Not configured';
            }

            // Logs
            const logsContainer = document.getElementById('logs-container');
            if (data.recentLogs.length > 0) {
                logsContainer.innerHTML = data.recentLogs.map(function(log) {
                    return '<div class="log-entry">' +
                        '<div class="log-timestamp">' + new Date(log.timestamp).toLocaleTimeString() + '</div>' +
                        '<div class="log-level ' + log.level + '">' + log.level.toUpperCase() + '</div>' +
                        '<div class="log-event">' + (log.tool ? '[' + log.tool + '] ' : '') + log.event + '</div>' +
                    '</div>';
                }).join('');
            } else {
                logsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">No recent activity</div>';
            }

            document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
        }

        // Initial fetch
        fetchDashboardData();

        // Auto-refresh every 5 seconds
        setInterval(fetchDashboardData, 5000);
    </script>
</body>
</html>`;
}

/**
 * Generates the metrics endpoint code that provides data for the dashboard.
 */
export function generateMetricsEndpoint(): string {
    return `
/**
 * Metrics endpoint for the Spellbook dashboard.
 * Returns server health, metrics, circuit breaker state, and recent logs.
 */
app.get('/_spellbook/metrics', (req, res) => {
    const telemetry = require('@spellbook/core/runtime').telemetry;
    const health = require('@spellbook/core/runtime').health;

    // Calculate metrics from telemetry data
    const totalRequests = recentRequests.length;
    const successfulRequests = recentRequests.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const latencies = recentRequests.map(r => r.latency).filter(l => l != null);
    const avgLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    const errorRate = totalRequests > 0
        ? (failedRequests / totalRequests) * 100
        : 0;

    // Sort by P95
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p95Latency = sortedLatencies.length > 0
        ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)]
        : 0;

    // Get circuit breaker state if configured
    let circuitBreaker = undefined;
    if (global.spellbookCircuitBreaker) {
        const cb = global.spellbookCircuitBreaker;
        circuitBreaker = {
            state: cb.getState(),
            failures: cb.getFailureCount(),
            lastFailureTime: cb.getLastFailureTime()
        };
    }

    res.json({
        serverName: packageJson.name || 'MCP Server',
        serverVersion: packageJson.version || '1.0.0',
        uptime: process.uptime(),
        health: global.healthStatus || { status: 'healthy', checks: {} },
        metrics: {
            totalRequests,
            successfulRequests,
            failedRequests,
            avgLatency,
            p95Latency,
            errorRate
        },
        circuitBreaker,
        recentLogs: recentLogs.slice(-50).map(log => ({
            timestamp: log.timestamp,
            level: log.level,
            event: log.event,
            tool: log.tool
        }))
    });
});

// Dashboard route
app.get('/_spellbook/dashboard', (req, res) => {
    res.set('Content-Type', 'text/html');
    res.send(dashboardHtml);
});
`;
}
