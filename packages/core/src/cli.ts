#!/usr/bin/env node
/**
 * Spellbook CLI
 *
 * Bulk test all spells for CI/CD verification.
 */

import { writeFile } from 'fs/promises';
import { resolve } from 'path';
import { bulkTestTools, type BulkTestReport, type BulkTestResult, type BulkTestTool } from './bulk-test.js';
import { loadSpells, DEFAULT_SPELLS_FILE } from './storage.js';
import type { Spell, Action } from './types.js';
import type { JSONSchema } from './schema-inference.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

const command = args[0];

if (command === 'test') {
  runTestCommand(args.slice(1)).catch(err => {
    console.error(`[spellbook] Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
} else {
  console.error(`[spellbook] Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

async function runTestCommand(cliArgs: string[]) {
  const flags = parseFlags(cliArgs);
  const all = flags.boolean('--all') || true;
  const spellsPath = flags.string('--spells') || DEFAULT_SPELLS_FILE;
  const reportPath = resolve(flags.string('--report') || 'spellbook-report.json');

  const options = {
    concurrency: flags.number('--concurrency'),
    timeoutMs: flags.number('--timeout'),
    rps: flags.number('--rps'),
    retries: flags.number('--retries')
  };

  if (!all) {
    throw new Error('Only --all is supported for now.');
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

function printUsage() {
  console.log(`Spellbook CLI

Usage:
  spellbook test --all [--spells <path>] [--report <path>]

Options:
  --spells       Path to spells.json (default: .kiro/data/spells.json)
  --report       Output report file (default: spellbook-report.json)
  --concurrency  Max parallel requests (default: 6)
  --timeout      Request timeout ms (default: 30000)
  --rps          Rate limit (default: 10)
  --retries      Retry count (default: 2)
`);
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

function parseFlags(argv: string[]) {
  return {
    boolean: (flag: string) => argv.includes(flag),
    string: (flag: string) => {
      const idx = argv.indexOf(flag);
      if (idx === -1) return undefined;
      return argv[idx + 1];
    },
    number: (flag: string) => {
      const value = Number((() => {
        const idx = argv.indexOf(flag);
        if (idx === -1) return undefined;
        return argv[idx + 1];
      })());
      return Number.isFinite(value) ? value : undefined;
    }
  };
}
