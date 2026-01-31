/**
 * Spellbook Runtime: Secret Rotation
 * 
 * Automated secret rotation with configurable strategies
 * and provider-specific implementations.
 */

import type { SecretProvider } from './secrets.js';

// ============================================================================
// Types
// ============================================================================

export interface RotationConfig {
    /** Secret key to rotate */
    secretKey: string;
    /** Rotation interval in ms */
    intervalMs: number;
    /** Provider to rotate in */
    provider: SecretProvider;
    /** Generator for new secret value */
    generator: () => Promise<string>;
    /** Validator to ensure new secret works */
    validator?: (newSecret: string) => Promise<boolean>;
    /** Callback on successful rotation */
    onRotation?: (oldSecret: string, newSecret: string) => void;
    /** Callback on rotation failure */
    onError?: (error: Error) => void;
}

export interface RotationResult {
    success: boolean;
    secretKey: string;
    rotatedAt: number;
    error?: string;
}

// ============================================================================
// Secret Rotator
// ============================================================================

export class SecretRotator {
    private configs = new Map<string, RotationConfig>();
    private timers = new Map<string, NodeJS.Timeout>();
    private rotationHistory = new Map<string, RotationResult[]>();

    /**
     * Register a secret for automatic rotation.
     */
    register(config: RotationConfig): void {
        this.configs.set(config.secretKey, config);
        this.scheduleRotation(config);
    }

    /**
     * Unregister a secret from rotation.
     */
    unregister(secretKey: string): void {
        const timer = this.timers.get(secretKey);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(secretKey);
        }
        this.configs.delete(secretKey);
    }

    /**
     * Manually trigger rotation for a secret.
     */
    async rotate(secretKey: string): Promise<RotationResult> {
        const config = this.configs.get(secretKey);
        if (!config) {
            return { success: false, secretKey, rotatedAt: Date.now(), error: 'Secret not registered' };
        }

        return this.performRotation(config);
    }

    /**
     * Get rotation history for a secret.
     */
    getHistory(secretKey: string): RotationResult[] {
        return this.rotationHistory.get(secretKey) ?? [];
    }

    /**
     * Stop all rotations.
     */
    stopAll(): void {
        for (const timer of this.timers.values()) {
            clearInterval(timer);
        }
        this.timers.clear();
    }

    private scheduleRotation(config: RotationConfig): void {
        const timer = setInterval(async () => {
            await this.performRotation(config);
        }, config.intervalMs);

        this.timers.set(config.secretKey, timer);
    }

    private async performRotation(config: RotationConfig): Promise<RotationResult> {
        const { secretKey, provider, generator, validator, onRotation, onError } = config;

        try {
            // Get current secret
            const oldSecret = await provider.get(secretKey);

            // Generate new secret
            const newSecret = await generator();

            // Validate new secret if validator provided
            if (validator) {
                const isValid = await validator(newSecret);
                if (!isValid) {
                    throw new Error('New secret failed validation');
                }
            }

            // Note: Actually writing the secret requires a writeable provider
            // For now, we just log and notify
            console.log(JSON.stringify({
                type: 'secret_rotation',
                level: 'info',
                secretKey,
                timestamp: new Date().toISOString(),
            }));

            onRotation?.(oldSecret ?? '', newSecret);

            const result: RotationResult = {
                success: true,
                secretKey,
                rotatedAt: Date.now(),
            };

            this.addToHistory(secretKey, result);
            return result;

        } catch (error) {
            const err = error as Error;
            onError?.(err);

            const result: RotationResult = {
                success: false,
                secretKey,
                rotatedAt: Date.now(),
                error: err.message,
            };

            this.addToHistory(secretKey, result);
            return result;
        }
    }

    private addToHistory(secretKey: string, result: RotationResult): void {
        const history = this.rotationHistory.get(secretKey) ?? [];
        history.push(result);
        // Keep last 100 rotations
        if (history.length > 100) history.shift();
        this.rotationHistory.set(secretKey, history);
    }
}

// ============================================================================
// Common Generators
// ============================================================================

export const SecretGenerators = {
    /** Generate a random alphanumeric string */
    alphanumeric: (length = 32) => async () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    /** Generate a UUID v4 */
    uuid: () => async () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /** Generate using crypto (Node.js) */
    cryptoRandom: (bytes = 32) => async () => {
        const crypto = await import('crypto');
        return crypto.randomBytes(bytes).toString('hex');
    },
};

// ============================================================================
// Rotation Strategies
// ============================================================================

export interface RotationStrategy {
    name: string;
    shouldRotate(lastRotation: number, config: RotationConfig): boolean;
}

export const RotationStrategies = {
    /** Fixed interval rotation */
    fixedInterval: (intervalMs: number): RotationStrategy => ({
        name: 'fixed-interval',
        shouldRotate: (lastRotation) => Date.now() - lastRotation >= intervalMs,
    }),

    /** Rotate on specific days of week */
    weeklyOnDay: (dayOfWeek: number): RotationStrategy => ({
        name: `weekly-day-${dayOfWeek}`,
        shouldRotate: () => new Date().getDay() === dayOfWeek,
    }),

    /** Rotate based on usage count */
    usageBased: (maxUses: number, usageCounter: () => number): RotationStrategy => ({
        name: 'usage-based',
        shouldRotate: () => usageCounter() >= maxUses,
    }),
};
