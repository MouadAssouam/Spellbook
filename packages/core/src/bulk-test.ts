/**
 * Bulk Test Engine
 *
 * Runs parallel HTTP checks with rate limiting, retries, and schema drift detection.
 */

import { diffSchemas, type SchemaChange } from './api-watcher.js';
import { inferSchema, type JSONSchema, extractUrlParameters } from './schema-inference.js';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export interface BulkTestTool {
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  outputSchema?: JSONSchema;
}

export interface BulkTestOptions {
  concurrency?: number;
  timeoutMs?: number;
  rps?: number;
  retries?: number;
  authType?: 'apiKey' | 'bearer';
  authEnvVar?: string;
  authHeader?: string;
  headerKey?: string;
}

export interface BulkTestResult {
  name: string;
  method: string;
  url: string;
  ok: boolean;
  statusCode?: number;
  durationMs: number;
  contentType?: string;
  error?: string;
  authRequired?: boolean;
  inferredSchema?: JSONSchema;
  drift?: SchemaChange[];
  responseSample?: string;
}

export interface BulkTestReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  changed: number;
  results: BulkTestResult[];
}

const DEFAULTS = {
  concurrency: 6,
  timeoutMs: 30000,
  rps: 10,
  retries: 2
};

export async function bulkTestTools(
  tools: BulkTestTool[],
  options: BulkTestOptions = {}
): Promise<BulkTestReport> {
  const startedAt = new Date();
  const concurrency = clampInt(options.concurrency ?? DEFAULTS.concurrency, 1, 50);
  const timeoutMs = clampInt(options.timeoutMs ?? DEFAULTS.timeoutMs, 1000, 120000);
  const rps = clampInt(options.rps ?? DEFAULTS.rps, 1, 1000);
  const retries = clampInt(options.retries ?? DEFAULTS.retries, 0, 5);

  const limiter = new RateLimiter(rps);
  const queue = [...tools];
  const results: BulkTestResult[] = [];

  const workers = Array.from({ length: Math.min(concurrency, tools.length) }, () =>
    (async () => {
      while (queue.length > 0) {
        const tool = queue.shift();
        if (!tool) break;
        await limiter.waitTurn();
        const result = await testTool(tool, { ...options, timeoutMs, retries });
        results.push(result);
      }
    })()
  );

  await Promise.all(workers);

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  const changed = results.filter(r => r.drift && r.drift.length > 0).length;
  const finishedAt = new Date();

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    total: results.length,
    passed,
    failed,
    changed,
    results
  };
}

async function testTool(tool: BulkTestTool, options: BulkTestOptions): Promise<BulkTestResult> {
  const start = Date.now();
  const method = tool.method.toUpperCase();
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const retries = options.retries ?? DEFAULTS.retries;

  const params = extractTemplateParams(tool.url, tool.headers, tool.body);
  const testValues = buildTestValues(params);
  const resolvedUrl = interpolateTemplate(tool.url, testValues, true);

  try {
    await assertSafeUrl(resolvedUrl);
  } catch (err) {
    return {
      name: tool.name,
      method,
      url: tool.url,
      ok: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Invalid URL'
    };
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'Spellbook-Bulk-Test/1.0',
    ...interpolateHeaders(tool.headers || {}, testValues)
  };

  const authHeader = resolveAuthHeader(options);
  if (authHeader) {
    const headerKey = options.headerKey || (options.authType === 'apiKey' ? 'X-API-Key' : 'Authorization');
    headers[headerKey] = authHeader;
  }

  const body = tool.body ? interpolateTemplate(tool.body, testValues, false) : undefined;

  let lastError: string | undefined;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(resolvedUrl, {
        method,
        headers,
        body: body && method !== 'GET' ? body : undefined,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const statusCode = response.status;
      const authRequired = statusCode === 401 || statusCode === 403;

      let inferredSchema: JSONSchema | undefined;
      let responseSample: string | undefined;
      let ok = false;

      if (response.ok && contentType.includes('application/json')) {
        const text = await readBodyWithLimit(response, 5 * 1024 * 1024);
        responseSample = text.slice(0, 2000);
        const data = JSON.parse(text);
        inferredSchema = inferSchema(data);
        if (inferredSchema.type === 'object' && inferredSchema.properties && !inferredSchema.required) {
          inferredSchema = {
            ...inferredSchema,
            required: Object.keys(inferredSchema.properties)
          };
        }
        ok = true;
      } else if (response.ok) {
        const text = await readBodyWithLimit(response, 1024 * 1024).catch(() => '');
        responseSample = text.slice(0, 2000);
        return {
          name: tool.name,
          method,
          url: tool.url,
          ok: false,
          statusCode,
          durationMs: Date.now() - start,
          contentType,
          error: `Response is not JSON (${contentType || 'unknown'})`,
          authRequired,
          responseSample
        };
      } else {
        const text = await readBodyWithLimit(response, 1024 * 1024).catch(() => '');
        responseSample = text.slice(0, 2000);
        return {
          name: tool.name,
          method,
          url: tool.url,
          ok: false,
          statusCode,
          durationMs: Date.now() - start,
          contentType,
          error: `HTTP ${statusCode}`,
          authRequired,
          responseSample
        };
      }

      const drift = tool.outputSchema && inferredSchema
        ? diffSchemas(tool.outputSchema, inferredSchema, tool.name, tool.name)
        : [];

      return {
        name: tool.name,
        method,
        url: tool.url,
        ok,
        statusCode,
        durationMs: Date.now() - start,
        contentType,
        inferredSchema,
        drift
      };
    } catch (err) {
      const message = err instanceof Error
        ? (err.name === 'AbortError' ? 'Request timed out' : err.message)
        : 'Request failed';
      lastError = normalizeNetworkError(message);
      if (attempt < retries && shouldRetry(lastError)) {
        await sleep(200 * Math.pow(2, attempt));
        continue;
      }
      return {
        name: tool.name,
        method,
        url: tool.url,
        ok: false,
        durationMs: Date.now() - start,
        error: lastError
      };
    }
  }

  return {
    name: tool.name,
    method,
    url: tool.url,
    ok: false,
    durationMs: Date.now() - start,
    error: lastError || 'Request failed'
  };
}

function resolveAuthHeader(options: BulkTestOptions): string | undefined {
  if (options.authHeader) return options.authHeader;
  if (!options.authType || !options.authEnvVar) return undefined;
  const value = process.env[options.authEnvVar];
  if (!value) return undefined;
  return options.authType === 'bearer' ? `Bearer ${value}` : value;
}

function interpolateHeaders(headers: Record<string, string>, values: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    output[key] = interpolateTemplate(value, values, false);
  }
  return output;
}

function extractTemplateParams(
  url: string,
  headers?: Record<string, string>,
  body?: string
): string[] {
  const params = new Set<string>(extractUrlParameters(url));
  const pushMatches = (text?: string) => {
    if (!text) return;
    const regex = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      params.add(match[1]);
    }
  };
  if (headers) {
    for (const value of Object.values(headers)) {
      pushMatches(value);
    }
  }
  pushMatches(body);
  return Array.from(params);
}

function buildTestValues(params: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const param of params) {
    values[param] = generateTestValue(param);
  }
  return values;
}

function generateTestValue(param: string): string {
  const lower = param.toLowerCase();
  if (lower.includes('user') || lower === 'username' || lower === 'owner') return 'octocat';
  if (lower === 'repo' || lower === 'repository') return 'Hello-World';
  if (lower === 'id' || lower.endsWith('id') || lower.endsWith('_id')) return '1';
  if (lower === 'page') return '1';
  if (lower === 'limit' || lower === 'per_page' || lower === 'count') return '10';
  if (lower === 'query' || lower === 'q' || lower === 'search') return 'test';
  if (lower === 'city') return 'London';
  if (lower === 'country') return 'US';
  if (lower === 'language' || lower === 'lang') return 'en';
  return `test_${param}`;
}

function interpolateTemplate(template: string, values: Record<string, string>, encode: boolean): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = values[key] ?? `test_${key}`;
    return encode ? encodeURIComponent(value) : value;
  });
}

function normalizeNetworkError(message: string): string {
  if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
    return 'Network error';
  }
  return message;
}

function shouldRetry(message: string): boolean {
  return message.includes('Network error') || message.includes('timed out') || message.includes('timeout');
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.floor(Number.isFinite(value) ? value : min);
  return Math.min(Math.max(n, min), max);
}

class RateLimiter {
  private intervalMs: number;
  private nextTime: number;

  constructor(rps: number) {
    this.intervalMs = Math.floor(1000 / Math.max(1, rps));
    this.nextTime = Date.now();
  }

  async waitTurn(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.nextTime - now);
    this.nextTime = Math.max(this.nextTime, now) + this.intervalMs;
    if (wait > 0) {
      await sleep(wait);
    }
  }
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error(`Response too large (${contentLength} bytes). Max ${maxBytes} bytes.`);
  }

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
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isTestEnv(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
