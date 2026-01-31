/**
 * Spellbook Runtime: OAuth Token Manager
 * 
 * Handles token refresh, rotation, and storage for production OAuth flows.
 * Supports headless/CI environments.
 */

import type { SecretProvider } from './secrets.js';

// ============================================================================
// Types
// ============================================================================

export interface OAuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number; // Unix timestamp ms
    tokenType?: string;
    scope?: string;
}

export interface OAuthConfig {
    clientId: string;
    clientSecret?: string;
    clientSecretEnvVar?: string;
    tokenUrl: string;
    scopes?: string[];
}

export interface TokenStorage {
    get(): Promise<OAuthTokens | null>;
    set(tokens: OAuthTokens): Promise<void>;
    clear(): Promise<void>;
}

export interface TokenManagerOptions {
    config: OAuthConfig;
    storage: TokenStorage;
    /** Refresh tokens this many ms before expiry (default: 5 minutes) */
    refreshBuffer?: number;
    /** Callback when tokens are refreshed */
    onRefresh?: (tokens: OAuthTokens) => void;
    /** Callback on refresh failure */
    onRefreshError?: (error: Error) => void;
}

// ============================================================================
// Token Storage Implementations
// ============================================================================

/**
 * In-memory token storage (for testing/short-lived processes).
 */
export function createMemoryStorage(): TokenStorage {
    let tokens: OAuthTokens | null = null;

    return {
        async get() { return tokens; },
        async set(t) { tokens = t; },
        async clear() { tokens = null; },
    };
}

/**
 * Environment variable token storage.
 */
export function createEnvStorage(envVarPrefix = 'OAUTH_'): TokenStorage {
    return {
        async get() {
            const accessToken = process.env[`${envVarPrefix}ACCESS_TOKEN`];
            if (!accessToken) return null;

            const expiresAtStr = process.env[`${envVarPrefix}EXPIRES_AT`];
            return {
                accessToken,
                refreshToken: process.env[`${envVarPrefix}REFRESH_TOKEN`],
                expiresAt: expiresAtStr ? parseInt(expiresAtStr, 10) : undefined,
            };
        },
        async set(tokens) {
            process.env[`${envVarPrefix}ACCESS_TOKEN`] = tokens.accessToken;
            if (tokens.refreshToken) {
                process.env[`${envVarPrefix}REFRESH_TOKEN`] = tokens.refreshToken;
            }
            if (tokens.expiresAt) {
                process.env[`${envVarPrefix}EXPIRES_AT`] = String(tokens.expiresAt);
            }
        },
        async clear() {
            delete process.env[`${envVarPrefix}ACCESS_TOKEN`];
            delete process.env[`${envVarPrefix}REFRESH_TOKEN`];
            delete process.env[`${envVarPrefix}EXPIRES_AT`];
        },
    };
}

/**
 * Secret provider-backed token storage (for cloud deployments).
 */
export function createSecretStorage(
    provider: SecretProvider,
    secretKey = 'oauth_tokens'
): TokenStorage {
    return {
        async get() {
            const data = await provider.get(secretKey);
            return data ? JSON.parse(data) : null;
        },
        async set(tokens) {
            // Note: This requires a writeable secret provider
            console.warn('SecretStorage.set() requires manual secret update');
        },
        async clear() {
            console.warn('SecretStorage.clear() requires manual secret deletion');
        },
    };
}

// ============================================================================
// Token Manager
// ============================================================================

export class TokenManager {
    private config: OAuthConfig;
    private storage: TokenStorage;
    private refreshBuffer: number;
    private refreshTimer?: NodeJS.Timeout;
    private onRefresh?: (tokens: OAuthTokens) => void;
    private onRefreshError?: (error: Error) => void;

    constructor(options: TokenManagerOptions) {
        this.config = options.config;
        this.storage = options.storage;
        this.refreshBuffer = options.refreshBuffer ?? 5 * 60 * 1000; // 5 minutes
        this.onRefresh = options.onRefresh;
        this.onRefreshError = options.onRefreshError;
    }

    /**
     * Get a valid access token, refreshing if needed.
     */
    async getAccessToken(): Promise<string> {
        const tokens = await this.storage.get();

        if (!tokens) {
            throw new Error('No OAuth tokens available. Run initial authentication first.');
        }

        // Check if refresh needed
        if (this.needsRefresh(tokens)) {
            if (tokens.refreshToken) {
                const newTokens = await this.refresh(tokens.refreshToken);
                return newTokens.accessToken;
            }
            throw new Error('Token expired and no refresh token available');
        }

        return tokens.accessToken;
    }

    /**
     * Check if tokens need refresh.
     */
    private needsRefresh(tokens: OAuthTokens): boolean {
        if (!tokens.expiresAt) return false;
        return Date.now() >= tokens.expiresAt - this.refreshBuffer;
    }

    /**
     * Refresh tokens using refresh token.
     */
    async refresh(refreshToken: string): Promise<OAuthTokens> {
        try {
            const clientSecret = getClientSecret(this.config);
            const response = await fetch(this.config.tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: this.config.clientId,
                    client_secret: clientSecret,
                }).toString(),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Token refresh failed: ${response.status} ${error}`);
            }

            const data = await response.json();

            const tokens: OAuthTokens = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token ?? refreshToken,
                expiresAt: data.expires_in
                    ? Date.now() + data.expires_in * 1000
                    : undefined,
                tokenType: data.token_type,
                scope: data.scope,
            };

            await this.storage.set(tokens);
            this.onRefresh?.(tokens);
            this.scheduleRefresh(tokens);

            return tokens;
        } catch (error) {
            this.onRefreshError?.(error as Error);
            throw error;
        }
    }

    /**
     * Exchange authorization code for tokens.
     */
    async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
        const clientSecret = getClientSecret(this.config);
        const response = await fetch(this.config.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: this.config.clientId,
                client_secret: clientSecret,
            }).toString(),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${response.status} ${error}`);
        }

        const data = await response.json();

        const tokens: OAuthTokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: data.expires_in
                ? Date.now() + data.expires_in * 1000
                : undefined,
            tokenType: data.token_type,
            scope: data.scope,
        };

        await this.storage.set(tokens);
        this.scheduleRefresh(tokens);

        return tokens;
    }

    /**
     * Schedule automatic token refresh.
     */
    private scheduleRefresh(tokens: OAuthTokens): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        if (!tokens.expiresAt || !tokens.refreshToken) return;

        const refreshIn = tokens.expiresAt - this.refreshBuffer - Date.now();

        if (refreshIn > 0) {
            this.refreshTimer = setTimeout(async () => {
                try {
                    await this.refresh(tokens.refreshToken!);
                } catch (error) {
                    console.error('Auto-refresh failed:', error);
                }
            }, refreshIn);
        }
    }

    /**
     * Start auto-refresh loop.
     */
    async startAutoRefresh(): Promise<void> {
        const tokens = await this.storage.get();
        if (tokens) {
            this.scheduleRefresh(tokens);
        }
    }

    /**
     * Stop auto-refresh loop.
     */
    stopAutoRefresh(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    /**
     * Clear stored tokens and stop refresh.
     */
    async logout(): Promise<void> {
        this.stopAutoRefresh();
        await this.storage.clear();
    }
}

// ============================================================================
// Headless Auth (for CI/CD)
// ============================================================================

export interface HeadlessAuthOptions {
    config: OAuthConfig;
    /** Service account or machine token */
    serviceAccountToken?: string;
    /** Client credentials flow */
    useClientCredentials?: boolean;
}

/**
 * Get tokens using client credentials flow (for service accounts).
 */
export async function getClientCredentialsToken(options: HeadlessAuthOptions): Promise<OAuthTokens> {
    const { config } = options;
    const clientSecret = getClientSecret(config);

    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.clientId,
            client_secret: clientSecret,
            scope: config.scopes?.join(' ') ?? '',
        }).toString(),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Client credentials auth failed: ${response.status} ${error}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        expiresAt: data.expires_in
            ? Date.now() + data.expires_in * 1000
            : undefined,
        tokenType: data.token_type,
        scope: data.scope,
    };
}

function getClientSecret(config: OAuthConfig): string {
    if (config.clientSecret) return config.clientSecret;
    const envVar = config.clientSecretEnvVar || 'CLIENT_SECRET';
    const secret = process.env[envVar];
    if (!secret) {
        throw new Error(`Missing OAuth client secret. Set ${envVar}.`);
    }
    return secret;
}
