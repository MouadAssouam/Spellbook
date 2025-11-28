// kiro-generated
/**
 * Spellbook VS Code Extension
 * 
 * Provides commands for creating MCP servers directly from VS Code.
 * 🔮 A tool that builds tools - the meta moment!
 */

import * as vscode from 'vscode';
import { createSpellCommand } from './commands/create-spell';
import { GrimoirePanel } from './webview/GrimoirePanel';
import { GrimoireSidebarProvider } from './providers/GrimoireSidebarProvider';
import { initLogger, log } from './utils/logger';

/**
 * Extension activation function.
 * Called when the extension is activated (command invoked).
 */
export function activate(context: vscode.ExtensionContext) {
  // Initialize output channel for logging
  const outputChannel = initLogger();
  context.subscriptions.push(outputChannel);
  
  log('🔮 Spellbook extension activated');

  // Register sidebar webview provider
  const sidebarProvider = new GrimoireSidebarProvider(context.extensionUri);
  const sidebarDisposable = vscode.window.registerWebviewViewProvider(
    GrimoireSidebarProvider.viewType,
    sidebarProvider
  );

  // Register create spell command (QuickPick flow)
  const createSpellDisposable = vscode.commands.registerCommand(
    'spellbook.createSpell',
    createSpellCommand
  );

  // Register open grimoire command (Webview Panel - fallback)
  const openGrimoireDisposable = vscode.commands.registerCommand(
    'spellbook.openGrimoire',
    () => GrimoirePanel.createOrShow(context.extensionUri)
  );

  // Register refresh command
  const refreshSpellsDisposable = vscode.commands.registerCommand(
    'spellbook.refreshSpells',
    () => sidebarProvider.refresh()
  );

  context.subscriptions.push(
    sidebarDisposable,
    createSpellDisposable,
    openGrimoireDisposable,
    refreshSpellsDisposable
  );
}

/**
 * Extension deactivation function.
 * Called when the extension is deactivated.
 */
export function deactivate() {
  log('📜 Spellbook extension deactivated');
}
