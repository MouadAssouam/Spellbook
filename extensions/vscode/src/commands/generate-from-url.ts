/**
 * Generate from URL Command
 *
 * The magic flow, reachable from the command palette:
 *   1. Paste URL
 *   2. Spellbook calls the API (live)
 *   3. Schema is inferred from the real response
 *   4. MCP server files are written to the workspace
 *
 * This is the same `magicFromUrl` the CLI exposes, surfaced as a VS Code action.
 */

import * as vscode from 'vscode';
import { magicFromUrl, magicToSpell, generateMCPServerV2 } from '@spellbook/core';
import { validateUrl } from '../utils/validation';
import { log, error, logSpellCreation, logFileGeneration, logSuccess, showOutput } from '../utils/logger';

/**
 * Command entry point. Prompts for a URL, tests the live API, and writes
 * generated files to `<workspace>/<tool-name>/`.
 */
export async function generateFromUrlCommand(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Spellbook: Open a folder first to generate an MCP server.');
    return;
  }

  try {
    // 1. URL
    const url = await vscode.window.showInputBox({
      prompt: ' API URL (supports {{placeholder}} parameters)',
      placeHolder: 'https://api.github.com/users/{{username}}',
      validateInput: validateUrl,
      ignoreFocusOut: true
    });
    if (!url) return;

    // 2. Method
    const method = await vscode.window.showQuickPick(
      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      { placeHolder: 'HTTP method', ignoreFocusOut: true }
    );
    if (!method) return;

    // 3. Optional auth header (resolved from env at call time, never stored)
    const authSpec = await vscode.window.showInputBox({
      prompt: ' Auth: enter $ENV_VAR (e.g. $GITHUB_TOKEN) or "Bearer xxx", or leave blank',
      placeHolder: '$GITHUB_TOKEN',
      ignoreFocusOut: true
    });

    let authHeader: string | undefined;
    if (authSpec && authSpec.trim().startsWith('$')) {
      const envVar = authSpec.trim().slice(1);
      const value = process.env[envVar];
      if (!value) {
        const proceed = await vscode.window.showWarningMessage(
          `Environment variable ${envVar} is not set. Continue without auth?`,
          'Continue',
          'Cancel'
        );
        if (proceed !== 'Continue') return;
      } else {
        authHeader = `Bearer ${value}`;
      }
    } else if (authSpec && authSpec.trim()) {
      authHeader = authSpec.trim();
    }

    // 4. Test values for placeholders (optional)
    const placeholderRegex = /\{\{(\w+)\}\}/g;
    const placeholders: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = placeholderRegex.exec(url)) !== null) {
      if (!placeholders.includes(m[1])) placeholders.push(m[1]);
    }

    const testValues: Record<string, string> = {};
    for (const param of placeholders) {
      const value = await vscode.window.showInputBox({
        prompt: ` Test value for {{${param}}}`,
        placeHolder: `value for ${param}`,
        ignoreFocusOut: true
      });
      if (value === undefined) return; // user cancelled
      if (value) testValues[param] = value;
    }

    // 5. Run the magic, with a progress indicator
    let result: Awaited<ReturnType<typeof magicFromUrl>>;
    let cancelled = false;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: ` Spellbook: testing ${method} ${url}`,
        cancellable: true
      },
      async (_progress, token) => {
        token.onCancellationRequested(() => {
          cancelled = true;
        });
        result = await magicFromUrl(url, { method, testValues, authHeader, timeout: 15000 });
      }
    );

    if (cancelled) {
      log(' Generate-from-URL cancelled by user');
      return;
    }

    if (!result!.success || !result!.spell) {
      const action = await vscode.window.showErrorMessage(
        ` Spellbook: API test failed — ${result!.error}`,
        'Show Details'
      );
      if (action === 'Show Details') showOutput();
      return;
    }

    // 6. Show what happened + offer overrides
    const meta = result!.responseMeta;
    const generated = result!.spell;

    const defaultName = generated.name;
    const name = await vscode.window.showInputBox({
      prompt: ' Tool name (kebab-case, 3-50 chars)',
      value: defaultName,
      validateInput: (v: string) => {
        if (v.length < 3 || v.length > 50) return '3-50 characters';
        if (!/^[a-zA-Z0-9-]+$/.test(v)) return 'Letters, numbers, hyphens only';
        return null;
      },
      ignoreFocusOut: true
    });
    if (!name) return;

    // 7. Build + write files
    const spell = magicToSpell(generated, { name });
    logSpellCreation(spell.name, 'http');

    const spellDir = vscode.Uri.joinPath(workspaceFolder.uri, spell.name);

    // Overwrite guard
    try {
      await vscode.workspace.fs.stat(spellDir);
      const overwrite = await vscode.window.showWarningMessage(
        `"${spell.name}" already exists in this workspace.`,
        'Overwrite',
        'Cancel'
      );
      if (overwrite !== 'Overwrite') {
        log(` Generate-from-URL cancelled: "${name}" already exists`);
        return;
      }
    } catch {
      // doesn't exist — good
    }

    const files = generateMCPServerV2(spell);
    await vscode.workspace.fs.createDirectory(spellDir);
    for (const [filename, content] of Object.entries(files)) {
      const fileUri = vscode.Uri.joinPath(spellDir, filename);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content as string, 'utf8'));
    }
    logFileGeneration(Object.keys(files));
    logSuccess(spell.name, spellDir.fsPath);

    // 8. Success — show response details + quick actions
    const summary = ` ${meta?.status ?? '?'} ${meta?.contentType ?? ''} — "${spell.name}" summoned.`;
    const choice = await vscode.window.showInformationMessage(
      summary,
      'Open README',
      'Copy MCP Config'
    );

    if (choice === 'Open README') {
      const readmeUri = vscode.Uri.joinPath(spellDir, 'README.md');
      const doc = await vscode.workspace.openTextDocument(readmeUri);
      await vscode.window.showTextDocument(doc);
    } else if (choice === 'Copy MCP Config') {
      const config = {
        mcpServers: {
          [spell.name]: { command: 'docker', args: ['run', '--rm', '-i', spell.name] }
        }
      };
      await vscode.env.clipboard.writeText(JSON.stringify(config, null, 2));
      vscode.window.showInformationMessage(' MCP config copied to clipboard.');
    }

    // Surface any warnings (auth required, non-JSON, etc.)
    for (const w of result!.warnings || []) {
      vscode.window.showWarningMessage(` Spellbook: ${w}`);
    }
  } catch (err) {
    error('Generate-from-URL failed', err instanceof Error ? err : undefined);
    const action = await vscode.window.showErrorMessage(
      ` Spellbook: ${err instanceof Error ? err.message : String(err)}`,
      'Show Details'
    );
    if (action === 'Show Details') showOutput();
  }
}
