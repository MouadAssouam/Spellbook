/**
 * Spellbook Runtime: Config Versioning
 * 
 * Supports versioned configurations for A/B testing,
 * rollback, and gradual rollouts.
 */

// ============================================================================
// Types
// ============================================================================

export interface VersionedConfig<T> {
    version: string;
    timestamp: number;
    config: T;
    metadata?: {
        author?: string;
        description?: string;
        tags?: string[];
    };
}

export interface ConfigVersion {
    version: string;
    timestamp: number;
    hash: string;
}

export interface ConfigManagerOptions<T> {
    /** Current active config */
    current: VersionedConfig<T>;
    /** Storage for config versions */
    storage?: ConfigStorage<T>;
    /** Validation function */
    validate?: (config: T) => boolean;
    /** Callback on config change */
    onChange?: (oldConfig: T, newConfig: T) => void;
}

export interface ConfigStorage<T> {
    save(config: VersionedConfig<T>): Promise<void>;
    load(version: string): Promise<VersionedConfig<T> | null>;
    list(): Promise<ConfigVersion[]>;
    delete(version: string): Promise<void>;
}

// ============================================================================
// In-Memory Storage
// ============================================================================

export function createMemoryConfigStorage<T>(): ConfigStorage<T> {
    const configs = new Map<string, VersionedConfig<T>>();

    return {
        async save(config) {
            configs.set(config.version, config);
        },

        async load(version) {
            return configs.get(version) ?? null;
        },

        async list() {
            return Array.from(configs.values()).map(c => ({
                version: c.version,
                timestamp: c.timestamp,
                hash: hashConfig(c.config),
            }));
        },

        async delete(version) {
            configs.delete(version);
        },
    };
}

// ============================================================================
// Config Manager
// ============================================================================

export class ConfigManager<T> {
    private current: VersionedConfig<T>;
    private storage?: ConfigStorage<T>;
    private validate?: (config: T) => boolean;
    private onChange?: (oldConfig: T, newConfig: T) => void;
    private history: VersionedConfig<T>[] = [];

    constructor(options: ConfigManagerOptions<T>) {
        this.current = options.current;
        this.storage = options.storage;
        this.validate = options.validate;
        this.onChange = options.onChange;
        this.history.push(this.current);
    }

    /**
     * Get current config.
     */
    get(): T {
        return this.current.config;
    }

    /**
     * Get current version info.
     */
    getVersion(): ConfigVersion {
        return {
            version: this.current.version,
            timestamp: this.current.timestamp,
            hash: hashConfig(this.current.config),
        };
    }

    /**
     * Update config with new version.
     */
    async update(config: T, metadata?: VersionedConfig<T>['metadata']): Promise<string> {
        if (this.validate && !this.validate(config)) {
            throw new Error('Config validation failed');
        }

        const version = generateVersion();
        const newVersioned: VersionedConfig<T> = {
            version,
            timestamp: Date.now(),
            config,
            metadata,
        };

        const oldConfig = this.current.config;
        this.history.push(this.current);
        this.current = newVersioned;

        await this.storage?.save(newVersioned);
        this.onChange?.(oldConfig, config);

        return version;
    }

    /**
     * Rollback to a previous version.
     */
    async rollback(version: string): Promise<T> {
        // Try history first
        let target = this.history.find(h => h.version === version);

        // Try storage
        if (!target && this.storage) {
            target = await this.storage.load(version) ?? undefined;
        }

        if (!target) {
            throw new Error(`Version ${version} not found`);
        }

        const oldConfig = this.current.config;
        this.history.push(this.current);
        this.current = target;

        this.onChange?.(oldConfig, target.config);

        return target.config;
    }

    /**
     * Get version history.
     */
    getHistory(): ConfigVersion[] {
        return this.history.map(h => ({
            version: h.version,
            timestamp: h.timestamp,
            hash: hashConfig(h.config),
        }));
    }

    /**
     * Compare two config versions.
     */
    async diff(versionA: string, versionB: string): Promise<ConfigDiff> {
        const a = await this.loadVersion(versionA);
        const b = await this.loadVersion(versionB);

        if (!a || !b) {
            throw new Error('One or both versions not found');
        }

        return diffConfigs(a.config, b.config);
    }

    private async loadVersion(version: string): Promise<VersionedConfig<T> | null> {
        if (this.current.version === version) return this.current;

        const fromHistory = this.history.find(h => h.version === version);
        if (fromHistory) return fromHistory;

        return this.storage?.load(version) ?? null;
    }
}

// ============================================================================
// A/B Testing Support
// ============================================================================

export interface ABTestConfig<T> {
    name: string;
    variants: {
        name: string;
        config: Partial<T>;
        weight: number;
    }[];
}

export class ABTester<T> {
    private tests = new Map<string, ABTestConfig<T>>();
    private assignments = new Map<string, string>(); // userId -> variant

    /**
     * Register an A/B test.
     */
    registerTest(test: ABTestConfig<T>): void {
        // Normalize weights
        const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
        test.variants.forEach(v => v.weight = v.weight / totalWeight);

        this.tests.set(test.name, test);
    }

    /**
     * Get variant for a user.
     */
    getVariant(testName: string, userId: string): string {
        const cacheKey = `${testName}:${userId}`;

        if (this.assignments.has(cacheKey)) {
            return this.assignments.get(cacheKey)!;
        }

        const test = this.tests.get(testName);
        if (!test) throw new Error(`Test ${testName} not found`);

        // Deterministic assignment based on hash
        const hash = simpleHash(cacheKey);
        const normalized = (hash % 1000) / 1000;

        let cumulative = 0;
        for (const variant of test.variants) {
            cumulative += variant.weight;
            if (normalized <= cumulative) {
                this.assignments.set(cacheKey, variant.name);
                return variant.name;
            }
        }

        // Fallback to last variant
        const last = test.variants[test.variants.length - 1].name;
        this.assignments.set(cacheKey, last);
        return last;
    }

    /**
     * Get config with A/B test overrides applied.
     */
    getConfig(baseConfig: T, testName: string, userId: string): T {
        const test = this.tests.get(testName);
        if (!test) return baseConfig;

        const variantName = this.getVariant(testName, userId);
        const variant = test.variants.find(v => v.name === variantName);

        if (!variant) return baseConfig;

        return { ...baseConfig, ...variant.config };
    }
}

// ============================================================================
// Helpers
// ============================================================================

function generateVersion(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).slice(2, 8);
    return `v${date}-${random}`;
}

function hashConfig(config: unknown): string {
    const str = JSON.stringify(config);
    return simpleHash(str).toString(16).padStart(8, '0');
}

function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

export interface ConfigDiff {
    added: string[];
    removed: string[];
    changed: { path: string; oldValue: unknown; newValue: unknown }[];
}

function diffConfigs(a: unknown, b: unknown, path = ''): ConfigDiff {
    const result: ConfigDiff = { added: [], removed: [], changed: [] };

    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
        if (a !== b) {
            result.changed.push({ path: path || 'root', oldValue: a, newValue: b });
        }
        return result;
    }

    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);

    for (const key of allKeys) {
        const fullPath = path ? `${path}.${key}` : key;

        if (!(key in aObj)) {
            result.added.push(fullPath);
        } else if (!(key in bObj)) {
            result.removed.push(fullPath);
        } else if (JSON.stringify(aObj[key]) !== JSON.stringify(bObj[key])) {
            const nested = diffConfigs(aObj[key], bObj[key], fullPath);
            result.added.push(...nested.added);
            result.removed.push(...nested.removed);
            result.changed.push(...nested.changed);
        }
    }

    return result;
}
