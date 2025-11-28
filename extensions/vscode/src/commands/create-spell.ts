// kiro-generated
/**
 * Create Spell Command (Polished)
 * 
 * Collects spell details from user and generates MCP server files.
 * Includes example spells, schema builder, progress indication,
 * quick actions, and enhanced error handling.
 * 
 * 🔮 Summon your MCP tools with style!
 */

import * as vscode from 'vscode';
import { generateMCPServer } from '@spellbook/core';
import { randomUUID } from 'crypto';
import { buildSchema } from '../utils/schema-builder';
import { selectExample } from '../utils/examples';
import { validateSpellName, validateDescription, validateUrl } from '../utils/validation';
import { log, error, logSpellCreation, logFileGeneration, logSuccess, showOutput } from '../utils/logger';

/**
 * Main command function for creating MCP servers.
 * Prompts user for spell details and generates files in workspace.
 */
export async function createSpellCommand() {
  // Check for workspace
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('📜 Please open a folder first to summon an MCP server');
    return;
  }

  try {
    // Ask: Start from example or create new?
    const startMode = await vscode.window.showQuickPick(
      ['🆕 Create New Spell', '📚 Use Example Spell'],
      { 
        placeHolder: 'How would you like to begin?',
        title: '🔮 Spellbook: Summon MCP Server'
      }
    );
    if (!startMode) return;

    let name: string;
    let description: string;
    let action: any;
    let inputSchema: object;
    let outputSchema: object;

    if (startMode.includes('Example')) {
      // Load example
      const example = await selectExample();
      if (!example) return;

      // Pre-fill from example (allow modification)
      const nameInput = await vscode.window.showInputBox({
        prompt: '📛 Spell name (kebab-case, 3-50 characters)',
        value: example.name,
        validateInput: validateSpellName
      });
      if (!nameInput) return;
      name = nameInput;

      const descInput = await vscode.window.showInputBox({
        prompt: '📝 Description (100-500 characters)',
        value: example.description,
        validateInput: validateDescription
      });
      if (!descInput) return;
      description = descInput;

      action = example.action;
      inputSchema = example.inputSchema;
      outputSchema = example.outputSchema;

    } else {
      // Create new spell
      const nameInput = await vscode.window.showInputBox({
        prompt: '📛 Spell name (kebab-case, 3-50 characters)',
        placeHolder: 'github-fetcher',
        validateInput: validateSpellName
      });
      if (!nameInput) return;
      name = nameInput;

      const descInput = await vscode.window.showInputBox({
        prompt: '📝 Description (100-500 characters)',
        placeHolder: 'Fetches GitHub issues by repository and label. Useful for tracking bugs, features, and pull requests across multiple repositories.',
        validateInput: validateDescription
      });
      if (!descInput) return;
      description = descInput;

      // Select action type
      const actionType = await vscode.window.showQuickPick(
        ['🌐 HTTP Request', '📜 JavaScript Script'],
        { placeHolder: 'Select the spell\'s action type' }
      );
      if (!actionType) return;

      if (actionType.includes('HTTP')) {
        // Collect HTTP details
        const url = await vscode.window.showInputBox({
          prompt: '🔗 URL (supports {{variable}} placeholders)',
          placeHolder: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues',
          validateInput: validateUrl
        });
        if (!url) return;

        const method = await vscode.window.showQuickPick(
          ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          { placeHolder: 'Select HTTP method' }
        );
        if (!method) return;

        // Ask for headers
        let headers: Record<string, string> | undefined;
        const needHeaders = await vscode.window.showQuickPick(['No', 'Yes'], {
          placeHolder: 'Add HTTP headers?'
        });
        
        if (needHeaders === 'Yes') {
          headers = {};
          while (true) {
            const headerKey = await vscode.window.showInputBox({
              prompt: 'Header name (or leave empty to finish)',
              placeHolder: 'Authorization'
            });
            if (!headerKey) break;

            const headerValue = await vscode.window.showInputBox({
              prompt: `Value for "${headerKey}"`,
              placeHolder: 'Bearer {{token}}'
            });
            if (!headerValue) break;

            headers[headerKey] = headerValue;
          }
        }

        // Ask for body (only for POST/PUT/PATCH)
        let body: string | undefined;
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          const needBody = await vscode.window.showQuickPick(['No', 'Yes'], {
            placeHolder: 'Add request body?'
          });
          
          if (needBody === 'Yes') {
            body = await vscode.window.showInputBox({
              prompt: 'Request body template (supports {{variable}} placeholders)',
              placeHolder: '{"title": "{{title}}", "body": "{{body}}"}'
            });
          }
        }

        action = {
          type: 'http' as const,
          config: {
            url,
            method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
            ...(headers && Object.keys(headers).length > 0 && { headers }),
            ...(body && { body })
          }
        };
      } else {
        // Collect script details
        const code = await vscode.window.showInputBox({
          prompt: '💻 JavaScript code (receives "input" parameter)',
          placeHolder: 'return { result: input.value * 2 };',
          validateInput: (value: string) => {
            if (!value) return 'Code is required';
            if (value.length < 1) return 'Code cannot be empty';
            return null;
          }
        });
        if (!code) return;

        action = {
          type: 'script' as const,
          config: {
            runtime: 'node' as const,
            code
          }
        };
      }

      // Build schemas interactively
      inputSchema = await buildSchema('input');
      outputSchema = await buildSchema('output');
    }

    // Build spell object
    const spell = {
      id: randomUUID(),
      name,
      description,
      inputSchema: inputSchema as any,
      outputSchema: outputSchema as any,
      action
    };

    // Check for duplicate spell (Self-Enforcing Architecture)
    const existingSpellDir = vscode.Uri.joinPath(workspaceFolder.uri, name);
    try {
      await vscode.workspace.fs.stat(existingSpellDir);
      // Directory exists - spell already created
      const overwrite = await vscode.window.showWarningMessage(
        `❌ Spell "${name}" already exists in this workspace.`,
        'Overwrite',
        'Cancel'
      );
      if (overwrite !== 'Overwrite') {
        log(`⚠️ Spell creation cancelled: "${name}" already exists`);
        return;
      }
      log(`⚠️ Overwriting existing spell: ${name}`);
    } catch {
      // Directory doesn't exist - good to proceed
    }

    // Log spell creation
    logSpellCreation(name, action.type);

    // Generate files with cancellable progress
    let cancelled = false;
    let spellDir: vscode.Uri | undefined;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "🔮 Summoning Spell...",
      cancellable: true
    }, async (progress, token) => {
      // Handle cancellation
      token.onCancellationRequested(() => {
        cancelled = true;
        log(`⚠️ Spell creation cancelled by user: ${name}`);
      });

      // Step 1: Validate
      progress.report({ message: "Validating spell configuration..." });
      if (cancelled) return;
      await sleep(200); // Brief pause for UX

      // Step 2: Generate
      progress.report({ message: "Conjuring MCP server files..." });
      if (cancelled) return;
      const files = generateMCPServer(spell);
      logFileGeneration(Object.keys(files));

      // Step 3: Write files
      progress.report({ message: "Inscribing files to workspace..." });
      if (cancelled) return;
      
      spellDir = vscode.Uri.joinPath(workspaceFolder.uri, name);
      await vscode.workspace.fs.createDirectory(spellDir);

      for (const [filename, content] of Object.entries(files)) {
        if (cancelled) break;
        const fileUri = vscode.Uri.joinPath(spellDir, filename);
        const contentBuffer = Buffer.from(content as string, 'utf8');
        await vscode.workspace.fs.writeFile(fileUri, contentBuffer);
      }

      // Step 4: Complete
      if (!cancelled) {
        progress.report({ message: "✨ Spell summoned!" });
        logSuccess(name, spellDir.fsPath);
      }
    });

    // Handle cancellation cleanup
    if (cancelled && spellDir) {
      try {
        await vscode.workspace.fs.delete(spellDir, { recursive: true });
        log(`🧹 Cleaned up partial files for cancelled spell: ${name}`);
      } catch {
        // Ignore cleanup errors
      }
      return;
    }

    if (cancelled) return;

    // Show success with quick actions
    const action_choice = await vscode.window.showInformationMessage(
      `✨ Spell "${name}" has been summoned!`,
      'Open README',
      'Open Terminal',
      'Copy Config'
    );

    // Handle quick actions
    if (action_choice === 'Open README') {
      const readmeUri = vscode.Uri.joinPath(workspaceFolder.uri, name, 'README.md');
      const doc = await vscode.workspace.openTextDocument(readmeUri);
      await vscode.window.showTextDocument(doc);
    } else if (action_choice === 'Open Terminal') {
      const terminal = vscode.window.createTerminal({
        name: `🔮 ${name}`,
        cwd: vscode.Uri.joinPath(workspaceFolder.uri, name)
      });
      terminal.show();
      terminal.sendText('# Your spell is ready! Run: docker build -t ' + name + ' .');
    } else if (action_choice === 'Copy Config') {
      const config = JSON.stringify({
        mcpServers: {
          [name]: {
            command: 'docker',
            args: ['run', '--rm', '-i', name]
          }
        }
      }, null, 2);
      await vscode.env.clipboard.writeText(config);
      vscode.window.showInformationMessage('📋 MCP config copied to clipboard!');
    }

  } catch (err) {
    // Enhanced error handling
    const errorMessage = err instanceof Error ? err.message : String(err);
    error('Failed to create spell', err instanceof Error ? err : undefined);
    
    const action = await vscode.window.showErrorMessage(
      `❌ Failed to summon spell: ${errorMessage}`,
      'Show Details'
    );
    
    if (action === 'Show Details') {
      showOutput();
    }
  }
}

/**
 * Helper function for brief pauses (improves UX).
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
