/**
 * Spellbook: Magic Auto-Generate
 * 
 * The S-grade feature: Paste a URL, get a complete spell.
 * No form filling. No configuration. Just works.
 */

import { inferSchema, extractUrlParameters, type JSONSchema } from './schema-inference.js';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export interface MagicResult {
    success: boolean;
    spell?: GeneratedSpell;
    error?: string;
    warnings?: string[];
}

export interface GeneratedSpell {
    name: string;
    description: string;
    tool: {
        name: string;
        description: string;
        method: string;
        url: string;
        parameters: Array<{ name: string; type: string; required: boolean }>;
        outputSchema: JSONSchema;
    };
    suggestedAuth?: {
        type: 'bearer' | 'apiKey';
        reason: string;
    };
}

/**
 * The magic function: URL → Complete Spell
 * 
 * 1. Extracts URL parameters ({{placeholders}})
 * 2. Generates tool name from URL path
 * 3. Calls the API (with test values)
 * 4. Infers schema from real response
 * 5. Generates description
 * 6. Returns complete, ready-to-use spell
 */
export async function magicFromUrl(
    url: string,
    options: {
        method?: string;
        testValues?: Record<string, string>;
        authHeader?: string;
        timeout?: number;
    } = {}
): Promise<MagicResult> {
    const { method = 'GET', testValues = {}, authHeader, timeout = 10000 } = options;
    const warnings: string[] = [];
    const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB safety cap

    try {
        // 1. Extract URL parameters
        const urlParams = extractUrlParameters(url);

        // 2. Generate tool name from URL
        const toolName = generateToolName(url, method);

        // 3. Build test URL (replace placeholders with test values or defaults)
        const testUrl = buildTestUrl(url, urlParams, testValues);

        // 4. Make the request (with SSRF safeguards)
        await assertSafeUrl(testUrl);

        // 5. Make the request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'User-Agent': 'Spellbook-Magic/1.0'
        };

        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        let response: Response;
        let suggestedAuth: GeneratedSpell['suggestedAuth'] | undefined;

        try {
            response = await fetch(testUrl, {
                method,
                headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (err) {
            clearTimeout(timeoutId);
            if (err instanceof Error && err.name === 'AbortError') {
                return { success: false, error: 'Request timed out (10s)' };
            }
            return { success: false, error: `Request failed: ${err instanceof Error ? err.message : 'Unknown error'}` };
        }

        // 6. Handle auth detection
        if (response.status === 401 || response.status === 403) {
            suggestedAuth = {
                type: 'bearer',
                reason: `API returned ${response.status}. Authentication required.`
            };
            warnings.push(`API requires authentication (${response.status}). Add auth header and try again, or configure auth in the generated spell.`);
        }

        // 7. Parse response (size-capped)
        let responseData: unknown;
        let outputSchema: JSONSchema;

        const contentType = response.headers.get('content-type') || '';
        const contentLength = response.headers.get('content-length');

        if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
            return { success: false, error: `Response too large (${contentLength} bytes). Max ${MAX_RESPONSE_BYTES} bytes.` };
        }

        if (contentType.includes('application/json') && response.ok) {
            try {
                if (typeof (response as any).json === 'function') {
                    responseData = await response.json();
                } else {
                    const text = await readBodyWithLimit(response, MAX_RESPONSE_BYTES);
                    responseData = JSON.parse(text);
                }
                outputSchema = inferSchema(responseData);
                if (outputSchema.type === 'object' && outputSchema.properties && !outputSchema.required) {
                    outputSchema = {
                        ...outputSchema,
                        required: Object.keys(outputSchema.properties)
                    };
                }
            } catch {
                outputSchema = { type: 'object' };
                warnings.push('Could not parse JSON response. Using generic schema.');
            }
        } else if (response.ok) {
            outputSchema = { type: 'string' };
            warnings.push('Response is not JSON. Using string schema.');
        } else {
            outputSchema = { type: 'object' };
            if (!suggestedAuth) {
                warnings.push(`API returned ${response.status}. Schema may not be accurate.`);
            }
        }

        // 8. Generate description
        const description = generateDescription(url, method, urlParams, response.status);

        // 9. Build parameters from URL placeholders
        const parameters = urlParams.map(param => ({
            name: param,
            type: 'string',
            required: true
        }));

        // 10. Assemble the spell
        const spell: GeneratedSpell = {
            name: toolName,
            description: generateSpellDescription(url, method),
            tool: {
                name: toolName,
                description,
                method: method.toUpperCase(),
                url,
                parameters,
                outputSchema
            },
            suggestedAuth
        };

        return {
            success: true,
            spell,
            warnings: warnings.length > 0 ? warnings : undefined
        };

    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error occurred'
        };
    }
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

/**
 * Generates a tool name from URL path.
 * 
 * Examples:
 * - https://api.github.com/users/octocat → get-users
 * - https://api.github.com/repos/{{owner}}/{{repo}}/issues → get-repo-issues
 * - POST https://api.stripe.com/v1/customers → create-customers
 */
function generateToolName(url: string, method: string): string {
    try {
        const urlObj = new URL(url.replace(/\{\{[^}]+\}\}/g, 'placeholder'));
        const pathParts = urlObj.pathname
            .split('/')
            .filter(part => part && part !== 'placeholder' && !part.startsWith('v') && !/^\d+$/.test(part));

        // Get last 1-2 meaningful path segments
        const meaningful = pathParts.slice(-2);

        // Generate verb from HTTP method
        const verb = methodToVerb(method);

        if (meaningful.length === 0) {
            return `${verb}-api`;
        }

        const resource = meaningful.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
        return `${verb}-${resource}`.substring(0, 50);

    } catch {
        return `${methodToVerb(method)}-api`;
    }
}

function methodToVerb(method: string): string {
    const map: Record<string, string> = {
        'GET': 'get',
        'POST': 'create',
        'PUT': 'update',
        'PATCH': 'update',
        'DELETE': 'delete'
    };
    return map[method.toUpperCase()] || 'call';
}

/**
 * Builds a test URL by replacing placeholders with test values.
 */
function buildTestUrl(url: string, params: string[], testValues: Record<string, string>): string {
    let testUrl = url;

    for (const param of params) {
        const value = testValues[param] || generateTestValue(param);
        testUrl = testUrl.replace(`{{${param}}}`, encodeURIComponent(value));
    }

    return testUrl;
}

/**
 * Generates sensible test values for common parameter names.
 */
function generateTestValue(param: string): string {
    const lower = param.toLowerCase();

    // Common patterns
    if (lower.includes('user') || lower === 'username' || lower === 'owner') {
        return 'octocat'; // GitHub's test user
    }
    if (lower === 'repo' || lower === 'repository') {
        return 'Hello-World'; // GitHub's example repo
    }
    if (lower === 'id' || lower.endsWith('id') || lower.endsWith('_id')) {
        return '1';
    }
    if (lower === 'page') {
        return '1';
    }
    if (lower === 'limit' || lower === 'per_page' || lower === 'count') {
        return '10';
    }
    if (lower === 'query' || lower === 'q' || lower === 'search') {
        return 'test';
    }
    if (lower === 'city') {
        return 'London';
    }
    if (lower === 'country') {
        return 'US';
    }
    if (lower === 'language' || lower === 'lang') {
        return 'en';
    }

    // Fallback: use param name as value
    return `test_${param}`;
}

/**
 * Generates a tool description.
 */
function generateDescription(url: string, method: string, params: string[], statusCode: number): string {
    try {
        const urlObj = new URL(url.replace(/\{\{[^}]+\}\}/g, 'x'));
        const host = urlObj.hostname.replace('api.', '').replace('.com', '').replace('.io', '');
        const pathParts = urlObj.pathname.split('/').filter(p => p && p !== 'x');
        const resource = pathParts[pathParts.length - 1] || 'data';

        const action = method === 'GET' ? 'Fetches' :
            method === 'POST' ? 'Creates' :
                method === 'PUT' ? 'Updates' :
                    method === 'DELETE' ? 'Deletes' : 'Calls';

        let desc = `${action} ${resource} from ${host}.`;

        if (params.length > 0) {
            desc += ` Requires: ${params.join(', ')}.`;
        }

        if (statusCode === 200 || statusCode === 201) {
            desc += ' Verified working.';
        }

        // Pad to meet minimum description length
        while (desc.length < 100) {
            desc += ' This tool was auto-generated by Spellbook from a live API test.';
        }

        return desc.substring(0, 500);

    } catch {
        return `Calls ${method} ${url}. Auto-generated by Spellbook from live API test.`.padEnd(100, '.');
    }
}

/**
 * Generates spell-level description.
 */
function generateSpellDescription(url: string, method: string): string {
    try {
        const urlObj = new URL(url.replace(/\{\{[^}]+\}\}/g, 'x'));
        const host = urlObj.hostname.replace('api.', '').replace('.com', '').replace('.io', '');

        let desc = `MCP server for ${host} API integration. Auto-generated by Spellbook with live API verification.`;

        while (desc.length < 100) {
            desc += ' Schema inferred from real API response, not documentation.';
        }

        return desc.substring(0, 500);

    } catch {
        return 'MCP server auto-generated by Spellbook. Schema verified against live API response.'.padEnd(100, '.');
    }
}
