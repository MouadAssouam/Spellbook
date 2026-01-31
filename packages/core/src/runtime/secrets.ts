/**
 * Spellbook Runtime: Secret Provider Interface
 * 
 * Abstraction for secret management across different providers.
 * Enables proper secret lifecycle management in production deployments.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Secret provider interface for retrieving secrets at runtime.
 */
export interface SecretProvider {
    /** Provider name for logging */
    readonly name: string;

    /** Get a secret value by key */
    get(key: string): Promise<string | undefined>;

    /** Check if provider is configured and accessible */
    healthCheck?(): Promise<boolean>;

    /** Watch for secret changes (optional, for rotation support) */
    watch?(key: string, callback: (value: string) => void): () => void;
}

/**
 * Secret provider configuration.
 */
export interface SecretProviderConfig {
    type: 'env' | 'aws' | 'gcp' | 'azure' | 'vault';
    options?: Record<string, unknown>;
}

// ============================================================================
// Environment Variable Provider
// ============================================================================

export interface EnvProviderOptions {
    /** Prefix for environment variable names */
    prefix?: string;
}

/**
 * Environment variable secret provider.
 * Simple provider that reads secrets from process.env.
 */
export function createEnvProvider(options: EnvProviderOptions = {}): SecretProvider {
    const prefix = options.prefix ?? '';

    return {
        name: 'env',

        async get(key: string): Promise<string | undefined> {
            return process.env[prefix + key];
        },

        async healthCheck(): Promise<boolean> {
            return true; // Always healthy
        },
    };
}

// ============================================================================
// AWS Secrets Manager Provider
// ============================================================================

export interface AWSSecretsManagerOptions {
    /** AWS region */
    region: string;
    /** Optional secret prefix */
    prefix?: string;
    /** Cache TTL in ms (default: 5 minutes) */
    cacheTTL?: number;
}

/**
 * AWS Secrets Manager provider.
 * Requires @aws-sdk/client-secrets-manager to be installed.
 */
export function createAWSSecretsManagerProvider(options: AWSSecretsManagerOptions): SecretProvider {
    const { region, prefix = '', cacheTTL = 5 * 60 * 1000 } = options;
    const cache = new Map<string, { value: string; expires: number }>();

    return {
        name: 'aws-secrets-manager',

        async get(key: string): Promise<string | undefined> {
            const fullKey = prefix + key;

            // Check cache
            const cached = cache.get(fullKey);
            if (cached && cached.expires > Date.now()) {
                return cached.value;
            }

            try {
                // Dynamic import to avoid requiring AWS SDK unless used
                // @ts-ignore - AWS SDK is optional
                const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');

                const client = new SecretsManagerClient({ region });
                const response = await client.send(new GetSecretValueCommand({ SecretId: fullKey }));

                const value = response.SecretString;
                if (value) {
                    cache.set(fullKey, { value, expires: Date.now() + cacheTTL });
                }

                return value;
            } catch (error) {
                if ((error as any).name === 'ResourceNotFoundException') {
                    return undefined;
                }
                throw error;
            }
        },

        async healthCheck(): Promise<boolean> {
            try {
                // @ts-ignore - AWS SDK is optional
                const { SecretsManagerClient, ListSecretsCommand } = await import('@aws-sdk/client-secrets-manager');
                const client = new SecretsManagerClient({ region });
                await client.send(new ListSecretsCommand({ MaxResults: 1 }));
                return true;
            } catch {
                return false;
            }
        },
    };
}

// ============================================================================
// GCP Secret Manager Provider
// ============================================================================

export interface GCPSecretManagerOptions {
    /** GCP project ID */
    projectId: string;
    /** Optional secret prefix */
    prefix?: string;
    /** Cache TTL in ms (default: 5 minutes) */
    cacheTTL?: number;
}

/**
 * GCP Secret Manager provider.
 * Requires @google-cloud/secret-manager to be installed.
 */
export function createGCPSecretManagerProvider(options: GCPSecretManagerOptions): SecretProvider {
    const { projectId, prefix = '', cacheTTL = 5 * 60 * 1000 } = options;
    const cache = new Map<string, { value: string; expires: number }>();

    return {
        name: 'gcp-secret-manager',

        async get(key: string): Promise<string | undefined> {
            const fullKey = prefix + key;

            // Check cache
            const cached = cache.get(fullKey);
            if (cached && cached.expires > Date.now()) {
                return cached.value;
            }

            try {
                // Dynamic import to avoid requiring GCP SDK unless used
                // @ts-ignore - GCP SDK is optional
                const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');

                const client = new SecretManagerServiceClient();
                const [version] = await client.accessSecretVersion({
                    name: `projects/${projectId}/secrets/${fullKey}/versions/latest`,
                });

                const value = version.payload?.data?.toString();
                if (value) {
                    cache.set(fullKey, { value, expires: Date.now() + cacheTTL });
                }

                return value;
            } catch (error) {
                if ((error as any).code === 5) { // NOT_FOUND
                    return undefined;
                }
                throw error;
            }
        },

        async healthCheck(): Promise<boolean> {
            try {
                // @ts-ignore - GCP SDK is optional
                const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
                const client = new SecretManagerServiceClient();
                await client.listSecrets({ parent: `projects/${projectId}`, pageSize: 1 });
                return true;
            } catch {
                return false;
            }
        },
    };
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a secret provider from configuration.
 */
export function createSecretProvider(config: SecretProviderConfig): SecretProvider {
    switch (config.type) {
        case 'env':
            return createEnvProvider(config.options as EnvProviderOptions);

        case 'aws': {
            const opts = config.options as AWSSecretsManagerOptions | undefined;
            if (!opts?.region) {
                throw new Error('AWS Secrets Manager requires region option');
            }
            return createAWSSecretsManagerProvider(opts);
        }

        case 'gcp': {
            const opts = config.options as GCPSecretManagerOptions | undefined;
            if (!opts?.projectId) {
                throw new Error('GCP Secret Manager requires projectId option');
            }
            return createGCPSecretManagerProvider(opts);
        }

        default:
            throw new Error(`Unknown secret provider type: ${config.type}`);
    }
}

// ============================================================================
// Composite Provider (Fallback Chain)
// ============================================================================

/**
 * Create a composite provider that tries multiple providers in order.
 * Useful for dev (env) -> prod (cloud) fallback patterns.
 */
export function createCompositeProvider(providers: SecretProvider[]): SecretProvider {
    return {
        name: `composite(${providers.map(p => p.name).join(',')})`,

        async get(key: string): Promise<string | undefined> {
            for (const provider of providers) {
                const value = await provider.get(key);
                if (value !== undefined) {
                    return value;
                }
            }
            return undefined;
        },

        async healthCheck(): Promise<boolean> {
            // Healthy if at least one provider is healthy
            for (const provider of providers) {
                if (provider.healthCheck && await provider.healthCheck()) {
                    return true;
                }
            }
            return false;
        },
    };
}
