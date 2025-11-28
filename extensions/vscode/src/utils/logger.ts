// kiro-generated
/**
 * Spellbook Logger
 * 
 * Provides logging to VS Code output channel for debugging and diagnostics.
 */

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

/**
 * Initializes the output channel.
 * Call this from extension activation.
 */
export function initLogger(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Spellbook');
  }
  return outputChannel;
}

/**
 * Gets the output channel (creates if needed).
 */
export function getOutputChannel(): vscode.OutputChannel {
  return outputChannel || initLogger();
}

/**
 * Logs an info message with timestamp.
 */
export function log(message: string): void {
  const channel = getOutputChannel();
  const timestamp = new Date().toISOString();
  channel.appendLine(`[${timestamp}] INFO: ${message}`);
}

/**
 * Logs a debug message with timestamp.
 */
export function debug(message: string): void {
  const channel = getOutputChannel();
  const timestamp = new Date().toISOString();
  channel.appendLine(`[${timestamp}] DEBUG: ${message}`);
}

/**
 * Logs an error message with timestamp and optional stack trace.
 */
export function error(message: string, err?: Error): void {
  const channel = getOutputChannel();
  const timestamp = new Date().toISOString();
  channel.appendLine(`[${timestamp}] ERROR: ${message}`);
  
  if (err) {
    channel.appendLine(`  Message: ${err.message}`);
    if (err.stack) {
      channel.appendLine(`  Stack: ${err.stack}`);
    }
  }
}

/**
 * Shows the output channel to the user.
 */
export function showOutput(): void {
  getOutputChannel().show();
}

/**
 * Logs a spell creation event.
 */
export function logSpellCreation(name: string, actionType: string): void {
  log(`🔮 Creating spell: ${name} (${actionType})`);
}

/**
 * Logs file generation.
 */
export function logFileGeneration(files: string[]): void {
  log(`📄 Generated files: ${files.join(', ')}`);
}

/**
 * Logs successful completion.
 */
export function logSuccess(name: string, path: string): void {
  log(`✨ Spell "${name}" created successfully at ${path}`);
}
