#!/usr/bin/env node
/**
 * Spellbook CLI
 *
 * The steering wheel for the engine.
 *
 *   spellbook magic <url>          Paste URL -> tested, generated MCP server
 *   spellbook verify <url>         Call the API, show status + inferred schema
 *   spellbook init                 Interactive scaffold (name, URL, auth)
 *   spellbook test --all           Bulk-test every spell (CI gate, exit 2 on fail)
 */

import { writeFile, mkdir } from 'fs/promises';
import { resolve, join } from 'path';
import { bulkTestTools, type BulkTestReport, type BulkTestResult, type BulkTestTool } from './bulk-test.js';
import { loadSpells, DEFAULT_SPELLS_FILE } from './storage.js';
import { magicFromUrl, magicToSpell } from './magic.js';
import { generateMCPServerV2 } from './generator.js';
import type { Spell, Action } from './types.js';
import type { JSONSchema } from './schema-inference.js';

// ============================================================================
// Entry point
// ============================================================================

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

const command = args[0];
const rest = args.slice(1);

const COMMANDS = new Set(['magic', 'verify', 'init', 'test']);

if (!COMMANDS.has(command)) {
  console.error(`[spellbook] Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

run(command, rest).catch(err => {
  console.error(`[spellbook] Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

async function run(command: string, cliArgs: string[]) {
  switch (command) {
    case 'magic':
      return runMagic(cliArgs);
    case 'verify':
      return runVerify(cliArgs);
    case 'init':
      return runInit(cliArgs);
    case 'test':
      return runTestCommand(cliArgs);
  }
}

// ============================================================================
// spellbook magic <url>
// ============================================================================

async function runMagic(cliArgs: string[]) {
  const flags = parseFlags(cliArgs);
  const url = flags.value('--url') || positional(cliArgs)[0];
  if (!url) {
    console.error('[spellbook] Usage: spellbook magic <url> [--method GET] [--out ./my-tool] [--auth $TOKEN]');
    process.exit(1);
  }

  const method = flags.value('--method') || 'GET';
  const outDir = flags.value('--out') || defaultOutDir(url, method);
  const authHeader = resolveAuthHeader(flags.value('--auth'));
  const testValues = parseKeyValuePairs(flags.value('--params') || '');
  const json = flags.boolean('--json');

  console.error(`[spellbook] Testing API: ${method} ${url}`);
  const result = await magicFromUrl(url, { method, testValues, authHeader });

  if (!result.success || !result.spell) {
    if (json) {
      console.log(JSON.stringify({ success: false, error: result.error }));
    } else {
      console.error(`[spellbook] ✗ ${result.error}`);
    }
    process.exit(1);
  }

  const spell = magicToSpell(result.spell, { name: flags.value('--name') });

  if (json) {
    // Machine-readable: emit the spell + files payload
    const files = generateMCPServerV2(spell);
    console.log(JSON.stringify({
      success: true,
      spell,
      responseMeta: result.responseMeta,
      warnings: result.warnings,
      files
    }, null, 2));
    return;
  }

  // Human-readable: write files to disk
  const files = generateMCPServerV2(spell);
  await mkdir(outDir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    await writeFile(join(outDir, filename), content, 'utf-8');
  }

  const meta = result.responseMeta;
  console.error(`[spellbook] ✓ ${meta?.status ?? '?'} ${meta?.contentType ?? ''} (${meta?.durationMs ?? '?'}ms)`);
  console.error(`[spellbook] ✓ Generated MCP server in ${outDir}`);
  console.error(`[spellbook]   ${Object.keys(files).join(', ')}`);
  console.error('');
  console.error('Next steps:');
  console.error(`  cd ${outDir}`);
  console.error('  docker build -t ' + spell.name + ' .');
  console.error('');
  console.error('Add to your MCP client config:');
  console.error(JSON.stringify({
    mcpServers: {
      [spell.name]: { command: 'docker', args: ['run', '--rm', '-i', spell.name] }
    }
  }, null, 2));

  for (const w of result.warnings || []) {
    console.error(`[spellbook] ! ${w}`);
  }
}

// ============================================================================
// spellbook verify <url>
// ============================================================================

async function runVerify(cliArgs: string[]) {
  const flags = parseFlags(cliArgs);
  const url = flags.value('--url') || positional(cliArgs)[0];
  if (!url) {
    console.error('[spellbook] Usage: spellbook verify <url> [--method GET] [--auth $TOKEN]');
    process.exit(1);
  }

  const method = flags.value('--method') || 'GET';
  const authHeader = resolveAuthHeader(flags.value('--auth'));
  const testValues = parseKeyValuePairs(flags.value('--params') || '');
  const json = flags.boolean('--json');

  const result = await magicFromUrl(url, { method, testValues, authHeader });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  }

  if (!result.success) {
    console.error(`[spellbook] ✗ ${result.error}`);
    process.exit(1);
  }

  const meta = result.responseMeta;
  const tool = result.spell!.tool;

  console.log(`${method} ${url}`);
  console.log(`Status:        ${meta?.status ?? '?'}`);
  console.log(`Content-Type:  ${meta?.contentType ?? 'unknown'}`);
  console.log(`Duration:      ${meta?.durationMs ?? '?'}ms`);
  console.log(`Tool name:     ${tool.name}`);
  if (tool.parameters.length > 0) {
    console.log(`Parameters:    ${tool.parameters.map(p => p.name).join(', ')}`);
  }
  console.log('Inferred output schema:');
  console.log(JSON.stringify(tool.outputSchema, null, 2));

  if (result.spell!.suggestedAuth) {
    console.log(`Auth:          ${result.spell!.suggestedAuth.type} (${result.spell!.suggestedAuth.reason})`);
  }
  for (const w of result.warnings || []) {
    console.log(`! ${w}`);
  }
}

// ============================================================================
// spellbook init
// ============================================================================

async function runInit(_cliArgs: string[]) {
  // Interactive scaffold. Keep it dependency-free: read from stdin.
  console.log('Spellbook init — interactive scaffold');
  console.log('(Ctrl+C to cancel)\n');

  const name = await prompt('Tool name (kebab-case): ');
  if (!name) { console.error('Cancelled.'); process.exit(1); }

  const url = await prompt('API URL (use {{param}} for placeholders): ');
  if (!url) { console.error('Cancelled.'); process.exit(1); }

  const method = (await prompt('HTTP method [GET]: ')) || 'GET';
  const authEnv = await prompt('Auth env var (blank for none): ');

  console.log('\nGenerating and testing...');
  const result = await magicFromUrl(url, {
    method,
    authHeader: resolveAuthHeader(authEnv ? `$${authEnv}` : undefined)
  });

  if (!result.success || !result.spell) {
    console.error(`[spellbook] API test failed: ${result.error}`);
    console.error('[spellbook] Re-run when the API is reachable, or use `spellbook init --no-verify` (not yet implemented).');
    process.exit(1);
  }

  const spell = magicToSpell(result.spell, { name });
  const files = generateMCPServerV2(spell);
  const outDir = resolve(name);
  await mkdir(outDir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    await writeFile(join(outDir, filename), content, 'utf-8');
  }

  console.log(`[spellbook] ✓ Created ${outDir}`);
  console.log(`[spellbook]   Verified against live API (${result.responseMeta?.status}).`);
}

// ============================================================================
// spellbook test --all  (bulk test for CI/CD)
// ============================================================================

async function runTestCommand(cliArgs: string[]) {
  const flags = parseFlags(cliArgs);
  const all = flags.boolean('--all'); // FIXED: was `|| true`, always returned true
  const spellsPath = flags.value('--spells') || DEFAULT_SPELLS_FILE;
  const reportPath = resolve(flags.value('--report') || 'spellbook-report.json');

  const options = {
    concurrency: flags.number('--concurrency'),
    timeoutMs: flags.number('--timeout'),
    rps: flags.number('--rps'),
    retries: flags.number('--retries')
  };

  if (!all) {
    throw new Error('Only --all is supported for now. Usage: spellbook test --all');
  }

  const spells = await loadSpells(spellsPath);
  if (spells.size === 0) {
    console.log('[spellbook] No spells found.');
    return;
  }

  const reports: BulkTestReport[] = [];
  for (const spell of spells.values()) {
    const tools = toBulkTools(spell);
    if (tools.length === 0) continue;
    const report = await bulkTestTools(tools, {
      ...options,
      authType: spell.auth?.type === 'apiKey' ? 'apiKey' : spell.auth?.type === 'bearer' ? 'bearer' : undefined,
      authEnvVar: spell.auth?.type !== 'oauth2' ? spell.auth?.envVar : undefined,
      headerKey: spell.auth?.type === 'apiKey' ? spell.auth?.headerKey : undefined
    });
    reports.push(report);
  }

  const merged = mergeReports(reports);
  await writeFile(reportPath, JSON.stringify(merged, null, 2), 'utf-8');

  console.log(`[spellbook] Bulk test complete.`);
  console.log(`[spellbook] Total: ${merged.total}, Passed: ${merged.passed}, Failed: ${merged.failed}, Changed: ${merged.changed}`);
  console.log(`[spellbook] Report: ${reportPath}`);
  if (merged.failed > 0) {
    process.exit(2);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function toBulkTools(spell: Spell): BulkTestTool[] {
  return spell.tools
    .filter(isHttpTool)
    .map(t => ({
      name: `${spell.name}/${t.name}`,
      method: t.action.config.method,
      url: t.action.config.url,
      headers: t.action.config.headers,
      body: t.action.config.body,
      outputSchema: isJsonSchema(t.outputSchema) ? t.outputSchema : undefined
    }));
}

function mergeReports(reports: BulkTestReport[]): BulkTestReport {
  const startedAt = reports[0]?.startedAt || new Date().toISOString();
  const finishedAt = reports.length > 0 ? reports[reports.length - 1].finishedAt : new Date().toISOString();
  const results: BulkTestResult[] = reports.flatMap(r => r.results);
  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  const changed = results.filter(r => r.drift && r.drift.length > 0).length;
  return {
    startedAt,
    finishedAt,
    durationMs: reports.reduce((acc, r) => acc + r.durationMs, 0),
    total: results.length,
    passed,
    failed,
    changed,
    results
  };
}

function isHttpAction(action: Action): action is Extract<Action, { type: 'http' }> {
  return action.type === 'http';
}

function isHttpTool(tool: Spell['tools'][number]): tool is Spell['tools'][number] & { action: Extract<Action, { type: 'http' }> } {
  return isHttpAction(tool.action);
}

function isJsonSchema(value: unknown): value is JSONSchema {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as { type?: unknown }).type === 'string';
}

const VERB_MAP: Record<string, string> = {
  GET: 'get',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete'
};

/**
 * Derives a default output directory from a URL, e.g.
 *   https://api.github.com/users -> ./get-users
 */
function defaultOutDir(url: string, method: string): string {
  try {
    const u = new URL(url.replace(/\{\{[^}]+\}\}/g, 'placeholder'));
    const parts = u.pathname
      .split('/')
      .filter(p => p && p !== 'placeholder' && !p.startsWith('v') && !/^\d+$/.test(p));
    const verb = VERB_MAP[method.toUpperCase()] || 'call';
    const resource = parts.slice(-2).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'api';
    return `./${verb}-${resource}`.substring(0, 60);
  } catch {
    return `./${method.toLowerCase()}-api`;
  }
}

/**
 * Resolves an auth spec into an Authorization header value.
 *   $GITHUB_TOKEN  -> resolves env var
 *   Bearer abc123  -> literal
 *   (blank)        -> undefined
 */
function resolveAuthHeader(spec?: string): string | undefined {
  if (!spec) return undefined;
  const trimmed = spec.trim();
  if (trimmed.startsWith('$')) {
    const envValue = process.env[trimmed.slice(1)];
    if (!envValue) {
      console.error(`[spellbook] Warning: env var ${trimmed.slice(1)} is not set`);
      return undefined;
    }
    return `Bearer ${envValue}`;
  }
  return trimmed;
}

/**
 * Parses "key=value,key2=value2" into a record. Used for --params.
 */
function parseKeyValuePairs(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input) return out;
  for (const pair of input.split(',')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  }
  return out;
}

/**
 * Minimal stdin prompt. Resolves to the trimmed line, or '' on EOF.
 */
function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(question);
    let data = '';
    process.stdin.setEncoding('utf-8');
    const onData = (chunk: string) => {
      data += chunk;
      if (data.includes('\n')) {
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        resolve(data.trim());
      }
    };
    process.stdin.resume();
    process.stdin.once('data', onData);
  });
}

/**
 * Returns positional args (those not starting with -).
 */
function positional(argv: string[]): string[] {
  return argv.filter(a => !a.startsWith('-'));
}

function parseFlags(argv: string[]) {
  return {
    boolean: (flag: string) => argv.includes(flag),
    value: (flag: string) => {
      const idx = argv.indexOf(flag);
      if (idx === -1) return undefined;
      const next = argv[idx + 1];
      if (!next || next.startsWith('-')) return undefined;
      return next;
    },
    string: (flag: string) => {
      const idx = argv.indexOf(flag);
      if (idx === -1) return undefined;
      return argv[idx + 1];
    },
    number: (flag: string) => {
      const value = (() => {
        const idx = argv.indexOf(flag);
        if (idx === -1) return undefined;
        return argv[idx + 1];
      })();
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    }
  };
}

function printUsage() {
  console.log(`Spellbook CLI — the MCP generator that tests your APIs

Usage:
  spellbook magic <url> [options]    Test API and generate a complete MCP server
  spellbook verify <url> [options]   Call the API and show status + inferred schema
  spellbook init                     Interactive scaffold (prompts for name, URL, auth)
  spellbook test --all [options]     Bulk-test every spell (CI gate; exit 2 on fail)

magic options:
  --method <GET|POST|...>            HTTP method (default: GET)
  --out <dir>                        Output directory (default: ./<verb>-<resource>)
  --name <tool-name>                 Override the generated tool name
  --auth <$ENV|Bearer xxx>           Auth: $VAR resolves env, else literal header
  --params <k=v,k=v>                 Test values for {{placeholders}}
  --json                             Emit machine-readable JSON (no files written)

verify options:
  --method <GET|POST|...>            HTTP method (default: GET)
  --auth <$ENV|Bearer xxx>           Auth header spec
  --params <k=v,k=v>                 Test values for {{placeholders}}
  --json                             Emit machine-readable JSON

test options:
  --spells <path>                    Path to spells.json (default: .kiro/data/spells.json)
  --report <path>                    Output report file (default: spellbook-report.json)
  --concurrency <n>                  Max parallel requests (default: 6)
  --timeout <ms>                     Request timeout ms (default: 30000)
  --rps <n>                          Rate limit (default: 10)
  --retries <n>                      Retry count (default: 2)

Examples:
  spellbook magic https://api.github.com/users/octocat
  spellbook magic https://api.github.com/repos/{{owner}}/{{repo}}/issues --params owner=octocat,repo=Hello-World
  spellbook verify https://api.example.com/status
  spellbook verify https://api.stripe.com/v1/customers --auth \$STRIPE_API_KEY
  spellbook test --all --report ci-report.json
`);
}

// Ensure process exits even if stdin reader is dangling (e.g. after --json)
// Keep this export-free; the bin entries invoke the side effects above.
