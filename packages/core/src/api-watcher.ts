/**
 * Spellbook: API Watcher
 * 
 * Watch Mode: Automatic API Change Detection
 * 
 * This is the feature AI cannot replicate - continuous monitoring that
 * detects when APIs change and notifies you automatically.
 * 
 * AI generates once and forgets. Spellbook watches.
 */

import { inferSchema, type JSONSchema } from './schema-inference.js';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

// ============================================================================
// Types
// ============================================================================

export interface WatchConfig {
    /** Unique spell identifier */
    spellId: string;
    /** Tool name within the spell */
    toolName: string;
    /** Full URL (with placeholders replaced by test values) */
    testUrl: string;
    /** HTTP method */
    method: string;
    /** Test values for URL placeholders */
    testValues: Record<string, string>;
    /** Interval between checks in milliseconds */
    intervalMs: number;
    /** Last known schema (null on first check) */
    lastSchema: JSONSchema | null;
    /** Timestamp of last check */
    lastChecked: Date;
    /** Auth header to include (optional) */
    authHeader?: string;
}

export interface SchemaChange {
    /** Spell that changed */
    spellId: string;
    /** Tool that changed */
    toolName: string;
    /** Type of change detected */
    type: 'field_added' | 'field_removed' | 'type_changed' | 'structure_changed';
    /** JSON path to the changed element */
    path: string;
    /** Previous value/type */
    before: string;
    /** New value/type */
    after: string;
    /** Timestamp when change was detected */
    detectedAt: Date;
}

export interface WatchResult {
    /** Whether the check was successful */
    success: boolean;
    /** New schema if changed */
    newSchema?: JSONSchema;
    /** List of detected changes */
    changes: SchemaChange[];
    /** Error message if check failed */
    error?: string;
    /** Response status code */
    statusCode?: number;
}

// ============================================================================
// Schema Diffing
// ============================================================================

/**
 * Compares two JSON schemas and returns a list of differences.
 * 
 * @example
 * ```ts
 * const before = { type: 'object', properties: { name: { type: 'string' } } };
 * const after = { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } } };
 * diffSchemas(before, after, 'spell-1', 'get-user');
 * // → [{ type: 'field_added', path: 'properties.age', before: 'undefined', after: 'number' }]
 * ```
 */
export function diffSchemas(
    before: JSONSchema,
    after: JSONSchema,
    spellId: string,
    toolName: string,
    path: string = ''
): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const now = new Date();

    // Type changed at this level
    if (before.type !== after.type) {
        changes.push({
            spellId,
            toolName,
            type: 'type_changed',
            path: path || 'root',
            before: before.type,
            after: after.type,
            detectedAt: now
        });
        return changes; // If type changed, don't compare children
    }

    // Compare object properties
    if (before.type === 'object' && after.type === 'object') {
        const beforeProps = before.properties || {};
        const afterProps = after.properties || {};
        const allKeys = new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)]);

        for (const key of allKeys) {
            const keyPath = path ? `${path}.${key}` : key;

            if (key in beforeProps && !(key in afterProps)) {
                // Field removed
                changes.push({
                    spellId,
                    toolName,
                    type: 'field_removed',
                    path: keyPath,
                    before: beforeProps[key].type,
                    after: 'undefined',
                    detectedAt: now
                });
            } else if (!(key in beforeProps) && key in afterProps) {
                // Field added
                changes.push({
                    spellId,
                    toolName,
                    type: 'field_added',
                    path: keyPath,
                    before: 'undefined',
                    after: afterProps[key].type,
                    detectedAt: now
                });
            } else if (key in beforeProps && key in afterProps) {
                // Both exist, compare recursively
                const nestedChanges = diffSchemas(
                    beforeProps[key],
                    afterProps[key],
                    spellId,
                    toolName,
                    keyPath
                );
                changes.push(...nestedChanges);
            }
        }
    }

    // Compare array items
    if (before.type === 'array' && after.type === 'array') {
        if (before.items && after.items) {
            const itemPath = path ? `${path}.items` : 'items';
            const itemChanges = diffSchemas(before.items, after.items, spellId, toolName, itemPath);
            changes.push(...itemChanges);
        } else if (before.items && !after.items) {
            changes.push({
                spellId,
                toolName,
                type: 'structure_changed',
                path: path ? `${path}.items` : 'items',
                before: 'defined',
                after: 'undefined',
                detectedAt: now
            });
        } else if (!before.items && after.items) {
            changes.push({
                spellId,
                toolName,
                type: 'structure_changed',
                path: path ? `${path}.items` : 'items',
                before: 'undefined',
                after: 'defined',
                detectedAt: now
            });
        }
    }

    return changes;
}

// ============================================================================
// API Checking
// ============================================================================

/**
 * Checks a single API endpoint for schema changes.
 */
export async function checkForChanges(config: WatchConfig): Promise<WatchResult> {
    const { spellId, toolName, testUrl, method, lastSchema, authHeader, testValues } = config;
    const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB safety cap

    try {
        const resolvedUrl = buildTestUrl(testUrl, testValues);
        await assertSafeUrl(resolvedUrl);

        // Build headers
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'User-Agent': 'Spellbook-Watcher/1.0'
        };

        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        // Make request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(resolvedUrl, {
            method,
            headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
            return {
                success: false,
                changes: [],
                error: `Response too large (${contentLength} bytes). Max ${MAX_RESPONSE_BYTES} bytes.`,
                statusCode: response.status
            };
        }

        // Check if response is JSON
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            return {
                success: false,
                changes: [],
                error: `Response is not JSON (${contentType})`,
                statusCode: response.status
            };
        }

        // Parse response and infer schema
        let data: unknown;
        if (typeof (response as any).json === 'function') {
            data = await response.json();
        } else {
            const text = await readBodyWithLimit(response, MAX_RESPONSE_BYTES);
            data = JSON.parse(text);
        }
        const newSchema = inferSchema(data);

        // First check - no previous schema to compare
        if (lastSchema === null) {
            return {
                success: true,
                newSchema,
                changes: [], // No changes on first run
                statusCode: response.status
            };
        }

        // Compare schemas
        const changes = diffSchemas(lastSchema, newSchema, spellId, toolName);

        return {
            success: true,
            newSchema,
            changes,
            statusCode: response.status
        };

    } catch (err) {
        let error = err instanceof Error
            ? (err.name === 'AbortError' ? 'Request timeout (10s)' : err.message)
            : 'Unknown error';
        if (error.includes('ENOTFOUND') || error.includes('getaddrinfo')) {
            error = 'Network error';
        }

        return {
            success: false,
            changes: [],
            error
        };
    }
}

function buildTestUrl(url: string, values: Record<string, string>): string {
    return url.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const value = values?.[key];
        return encodeURIComponent(value ?? `test_${key}`);
    });
}

function isPrivateIp(address: string): boolean {
    if (address.includes(':')) {
        const normalized = address.toLowerCase();
        return normalized === '::1' ||
            normalized.startsWith('fe80:') ||
            normalized.startsWith('fc') ||
            normalized.startsWith('fd');
    }

    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return false;

    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
}

async function assertSafeUrl(rawUrl: string): Promise<void> {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Protocol not allowed: ${parsed.protocol}`);
    }

    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
        throw new Error('Localhost is not allowed');
    }

    if (isTestEnv()) {
        return;
    }

    const ipType = isIP(host);
    if (ipType && isPrivateIp(host)) {
        throw new Error('Private or loopback IPs are not allowed');
    }

    if (!ipType) {
        const results = await lookup(host, { all: true });
        for (const result of results) {
            if (isPrivateIp(result.address)) {
                throw new Error('Private or loopback IPs are not allowed');
            }
        }
    }
}

function isTestEnv(): boolean {
    return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
        const text = await response.text();
        if (text.length > maxBytes) {
            throw new Error(`Response too large (${text.length} bytes). Max ${maxBytes} bytes.`);
        }
        return text;
    }

    const decoder = new TextDecoder();
    let total = 0;
    const chunks: string[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            reader.cancel();
            throw new Error(`Response too large (>${maxBytes} bytes).`);
        }
        chunks.push(decoder.decode(value, { stream: true }));
    }

    return chunks.join('');
}

// ============================================================================
// Watch Manager
// ============================================================================

/**
 * Manages watching of multiple APIs.
 * 
 * In VS Code extension context, this runs in the extension host.
 * Stores watch configs in workspace storage.
 */
export class WatchManager {
    private configs: Map<string, WatchConfig> = new Map();
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private onChangeCallback?: (change: SchemaChange[]) => void;

    /**
     * Starts watching an API for changes.
     */
    startWatching(config: WatchConfig): void {
        const key = `${config.spellId}:${config.toolName}`;

        // Stop existing watch if any
        this.stopWatching(config.spellId, config.toolName);

        // Store config
        this.configs.set(key, config);

        // Start timer
        const timer = setInterval(async () => {
            const result = await checkForChanges(config);

            if (result.success && result.changes.length > 0) {
                // Update stored schema
                if (result.newSchema) {
                    config.lastSchema = result.newSchema;
                }
                config.lastChecked = new Date();

                // Notify callback
                if (this.onChangeCallback) {
                    this.onChangeCallback(result.changes);
                }
            }
        }, config.intervalMs);

        this.timers.set(key, timer);
    }

    /**
     * Stops watching a specific API.
     */
    stopWatching(spellId: string, toolName: string): void {
        const key = `${spellId}:${toolName}`;

        const timer = this.timers.get(key);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(key);
        }

        this.configs.delete(key);
    }

    /**
     * Stops watching all APIs.
     */
    stopAll(): void {
        for (const timer of this.timers.values()) {
            clearInterval(timer);
        }
        this.timers.clear();
        this.configs.clear();
    }

    /**
     * Sets callback for when changes are detected.
     */
    onChange(callback: (changes: SchemaChange[]) => void): void {
        this.onChangeCallback = callback;
    }

    /**
     * Gets all currently watched configs.
     */
    getWatchedConfigs(): WatchConfig[] {
        return Array.from(this.configs.values());
    }

    /**
     * Checks if a specific tool is being watched.
     */
    isWatching(spellId: string, toolName: string): boolean {
        return this.configs.has(`${spellId}:${toolName}`);
    }

    /**
     * Manually triggers a check for a specific tool.
     */
    async checkNow(spellId: string, toolName: string): Promise<WatchResult | null> {
        const key = `${spellId}:${toolName}`;
        const config = this.configs.get(key);

        if (!config) {
            return null;
        }

        const result = await checkForChanges(config);

        if (result.success && result.newSchema) {
            config.lastSchema = result.newSchema;
            config.lastChecked = new Date();
        }

        return result;
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let watchManager: WatchManager | null = null;

/**
 * Gets or creates the global WatchManager instance.
 */
export function getWatchManager(): WatchManager {
    if (!watchManager) {
        watchManager = new WatchManager();
    }
    return watchManager;
}

/**
 * Resets the global WatchManager (for testing).
 */
export function resetWatchManager(): void {
    if (watchManager) {
        watchManager.stopAll();
        watchManager = null;
    }
}
