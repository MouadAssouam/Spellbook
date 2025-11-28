/**
 * Grimoire Sidebar Provider - HAUNTED EDITION 👻
 * 
 * Embeds the spell builder directly in the VS Code sidebar using WebviewViewProvider.
 * Features tabbed interface with spooky animations, floating particles, and eerie glows.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateMCPServer } from '@spellbook/core';
import { randomUUID } from 'crypto';
import { log, logSpellCreation, logSuccess, error } from '../utils/logger';
import { examples } from '../utils/examples';

interface SpellInfo {
  name: string;
  description: string;
  path: string;
}

export class GrimoireSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'spellbook.grimoireView';
  
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview();
    webviewView.webview.onDidReceiveMessage(message => this._handleMessage(message));
    this._sendSpellsList();
    log('👻 Haunted Grimoire sidebar opened');
  }

  public refresh(): void {
    if (this._view) {
      this._sendSpellsList();
    }
  }

  public switchToSpellsTab(): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'tabChanged', tab: 'spells' });
    }
  }


  private async _handleMessage(message: any) {
    switch (message.type) {
      case 'validate':
        this._handleValidate(message.data);
        break;
      case 'generate':
        await this._handleGenerate(message.data);
        break;
      case 'loadExample':
        this._handleLoadExample(message.example);
        break;
      case 'getSpells':
        this._sendSpellsList();
        break;
      case 'openSpell':
        this._openSpellFolder(message.path);
        break;
    }
  }

  private _handleValidate(data: any) {
    const errors: Array<{ field: string; message: string }> = [];

    if (!data.name || data.name.length < 3) {
      errors.push({ field: 'name', message: 'Min 3 characters' });
    } else if (data.name.length > 50) {
      errors.push({ field: 'name', message: 'Max 50 characters' });
    } else if (!/^[a-zA-Z0-9-]+$/.test(data.name)) {
      errors.push({ field: 'name', message: 'Use kebab-case only' });
    }

    if (!data.description || data.description.length < 100) {
      errors.push({ field: 'description', message: `${data.description?.length || 0}/100 min` });
    } else if (data.description.length > 500) {
      errors.push({ field: 'description', message: 'Max 500 characters' });
    }

    if (data.actionType === 'http' && data.url) {
      try {
        const testUrl = data.url.replace(/\{\{[^}]+\}\}/g, 'placeholder');
        new URL(testUrl);
      } catch {
        errors.push({ field: 'url', message: 'Invalid URL' });
      }
    }

    if (data.actionType === 'script' && (!data.code || data.code.trim().length === 0)) {
      errors.push({ field: 'code', message: 'Code required' });
    }

    this._view?.webview.postMessage({ type: 'validationResult', errors });
  }

  private async _handleGenerate(data: any) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this._view?.webview.postMessage({ type: 'generateResult', success: false, message: 'Open a folder first' });
      return;
    }

    try {
      const spell = this._buildSpell(data);
      logSpellCreation(spell.name, spell.action.type);

      const spellDir = vscode.Uri.joinPath(workspaceFolder.uri, spell.name);
      
      try {
        await vscode.workspace.fs.stat(spellDir);
        this._view?.webview.postMessage({ type: 'generateResult', success: false, message: `"${spell.name}" already exists` });
        return;
      } catch {
        // Good - doesn't exist
      }

      const files = generateMCPServer(spell);
      await vscode.workspace.fs.createDirectory(spellDir);

      for (const [filename, content] of Object.entries(files)) {
        const fileUri = vscode.Uri.joinPath(spellDir, filename);
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content as string, 'utf8'));
      }

      logSuccess(spell.name, spellDir.fsPath);
      this._view?.webview.postMessage({ type: 'generateResult', success: true, message: `👻 "${spell.name}" risen from the void!` });
      this._sendSpellsList();
      this.switchToSpellsTab();

    } catch (err) {
      error('Failed to generate spell', err instanceof Error ? err : undefined);
      this._view?.webview.postMessage({ type: 'generateResult', success: false, message: err instanceof Error ? err.message : 'Generation failed' });
    }
  }

  private _handleLoadExample(exampleName: string) {
    const example = examples[exampleName];
    if (example) {
      const parameters: Array<{ name: string; type: string; required: boolean }> = [];
      if (example.inputSchema?.properties) {
        const required = (example.inputSchema.required as string[]) || [];
        for (const [name, schema] of Object.entries(example.inputSchema.properties)) {
          parameters.push({ name, type: (schema as { type?: string }).type || 'string', required: required.includes(name) });
        }
      }
      this._view?.webview.postMessage({ 
        type: 'exampleLoaded', 
        data: {
          name: example.name,
          description: example.description,
          actionType: example.action.type,
          url: example.action.type === 'http' ? example.action.config.url : '',
          method: example.action.type === 'http' ? example.action.config.method : 'GET',
          code: example.action.type === 'script' ? example.action.config.code : '',
          parameters
        }
      });
    }
  }

  private async _sendSpellsList() {
    const spells = await this._getSpells();
    this._view?.webview.postMessage({ type: 'spellsList', spells });
  }

  private async _getSpells(): Promise<SpellInfo[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return [];

    const spells: SpellInfo[] = [];
    const workspaceRoot = workspaceFolder.uri.fsPath;

    try {
      const entries = await fs.promises.readdir(workspaceRoot, { withFileTypes: true });
      const excludeFolders = ['node_modules', 'dist', 'packages', 'extensions', 'scripts', 'examples'];

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && !excludeFolders.includes(entry.name)) {
          const spellPath = path.join(workspaceRoot, entry.name);
          const packageJsonPath = path.join(spellPath, 'package.json');
          const indexJsPath = path.join(spellPath, 'index.js');

          if (fs.existsSync(packageJsonPath) && fs.existsSync(indexJsPath)) {
            try {
              const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
              if (packageJson.name) {
                spells.push({ name: entry.name, description: packageJson.description || 'MCP Tool', path: spellPath });
              }
            } catch { /* Skip invalid */ }
          }
        }
      }
    } catch { /* Workspace not accessible */ }

    return spells;
  }

  private _openSpellFolder(spellPath: string) {
    const uri = vscode.Uri.file(spellPath);
    vscode.commands.executeCommand('revealInExplorer', uri);
  }

  private _buildSpell(data: any) {
    const inputSchema: any = { type: 'object', properties: {}, required: [] };
    if (data.parameters && Array.isArray(data.parameters)) {
      for (const param of data.parameters) {
        if (param.name) {
          inputSchema.properties[param.name] = { type: param.type || 'string' };
          if (param.required) inputSchema.required.push(param.name);
        }
      }
    }
    if (inputSchema.required.length === 0) delete inputSchema.required;

    const action = data.actionType === 'http' 
      ? { type: 'http' as const, config: { url: data.url, method: data.method || 'GET', ...(data.headers && Object.keys(data.headers).length > 0 && { headers: data.headers }), ...(data.body && { body: data.body }) } }
      : { type: 'script' as const, config: { runtime: 'node' as const, code: data.code } };

    return { id: randomUUID(), name: data.name, description: data.description, inputSchema, outputSchema: { type: 'object', properties: {} }, action };
  }


  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Haunted Grimoire</title>
  <style>
    :root {
      --bg: #0a0608;
      --surface: #1a0f12;
      --surface-light: #2a1a1f;
      --gold: #c9a227;
      --gold-glow: #ffd700;
      --gold-dim: #6b5a2f;
      --text: #e8dcc8;
      --text-dim: #7a6b5a;
      --error: #8b0000;
      --success: #2e8b57;
      --border: #3a2a2f;
      --blood: #4a0000;
      --ghost: rgba(200, 200, 255, 0.1);
      --mist: rgba(100, 80, 120, 0.15);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
      height: 100vh;
      overflow: hidden;
      position: relative;
    }
    
    /* Floating ghost particles */
    .particles { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden; z-index: 0; }
    .particle {
      position: absolute;
      width: 4px;
      height: 4px;
      background: radial-gradient(circle, rgba(255,215,0,0.6) 0%, transparent 70%);
      border-radius: 50%;
      animation: float 8s ease-in-out infinite;
      opacity: 0;
    }
    .particle:nth-child(1) { left: 10%; animation-delay: 0s; }
    .particle:nth-child(2) { left: 20%; animation-delay: 1s; }
    .particle:nth-child(3) { left: 30%; animation-delay: 2s; }
    .particle:nth-child(4) { left: 50%; animation-delay: 3s; }
    .particle:nth-child(5) { left: 70%; animation-delay: 4s; }
    .particle:nth-child(6) { left: 80%; animation-delay: 5s; }
    .particle:nth-child(7) { left: 90%; animation-delay: 6s; }
    .particle:nth-child(8) { left: 40%; animation-delay: 7s; }
    @keyframes float {
      0% { transform: translateY(100vh) scale(0); opacity: 0; }
      10% { opacity: 0.8; }
      90% { opacity: 0.8; }
      100% { transform: translateY(-20vh) scale(1); opacity: 0; }
    }
    
    /* Eerie mist */
    .mist {
      position: fixed; top: 0; left: 0; width: 200%; height: 100%;
      background: linear-gradient(90deg, transparent, var(--mist), transparent, var(--mist), transparent);
      animation: mistMove 20s linear infinite;
      pointer-events: none; z-index: 1;
    }
    @keyframes mistMove { 0% { transform: translateX(-50%); } 100% { transform: translateX(0%); } }
    
    .container { display: flex; flex-direction: column; height: 100%; position: relative; z-index: 2; }
    
    /* Haunted Tabs */
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--blood);
      background: linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%);
      box-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }
    .tab {
      flex: 1; padding: 12px 8px; background: transparent; border: none;
      color: var(--text-dim); cursor: pointer; font-size: 11px;
      transition: all 0.3s ease; position: relative; text-shadow: 0 0 10px transparent;
    }
    .tab::after {
      content: ''; position: absolute; bottom: 0; left: 50%; width: 0; height: 2px;
      background: var(--gold); box-shadow: 0 0 10px var(--gold-glow), 0 0 20px var(--gold-glow);
      transition: all 0.3s ease; transform: translateX(-50%);
    }
    .tab.active { color: var(--gold); text-shadow: 0 0 10px var(--gold-glow); }
    .tab.active::after { width: 80%; }
    .tab:hover { color: var(--text); text-shadow: 0 0 5px var(--ghost); }
    
    .tab-content { flex: 1; overflow-y: auto; padding: 12px; background: linear-gradient(180deg, transparent 0%, rgba(10,6,8,0.8) 100%); }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; animation: fadeIn 0.5s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    
    /* Spells List */
    .spells-list { display: flex; flex-direction: column; gap: 10px; }
    .spell-item {
      background: linear-gradient(135deg, var(--surface) 0%, var(--surface-light) 100%);
      border: 1px solid var(--border); border-radius: 8px; padding: 12px;
      cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden;
    }
    .spell-item::before {
      content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, var(--ghost), transparent);
      transition: left 0.5s ease;
    }
    .spell-item:hover::before { left: 100%; }
    .spell-item:hover {
      border-color: var(--gold-dim);
      box-shadow: 0 0 15px rgba(201, 162, 39, 0.2), inset 0 0 20px rgba(0,0,0,0.3);
      transform: translateX(3px);
    }
    .spell-name { color: var(--gold); font-weight: 500; margin-bottom: 4px; text-shadow: 0 0 5px rgba(201, 162, 39, 0.3); }
    .spell-desc { color: var(--text-dim); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty-state { text-align: center; padding: 30px 20px; color: var(--text-dim); font-style: italic; }
    .empty-state::before { content: '👻'; display: block; font-size: 32px; margin-bottom: 10px; animation: ghostBob 2s ease-in-out infinite; }
    @keyframes ghostBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    
    /* Example buttons */
    .examples { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
    .example-btn {
      background: linear-gradient(180deg, var(--surface-light) 0%, var(--surface) 100%);
      border: 1px solid var(--border); color: var(--text); padding: 8px 12px;
      border-radius: 6px; cursor: pointer; font-size: 11px; transition: all 0.3s ease;
    }
    .example-btn:hover { border-color: var(--gold); box-shadow: 0 0 10px rgba(201, 162, 39, 0.3); transform: translateY(-2px); }
    
    /* Form groups */
    .form-group { margin-bottom: 14px; position: relative; }
    .form-group label { display: block; color: var(--gold); margin-bottom: 6px; font-size: 11px; text-shadow: 0 0 5px rgba(201, 162, 39, 0.2); letter-spacing: 0.5px; }
    .form-group input, .form-group textarea, .form-group select {
      width: 100%; background: var(--bg); border: 1px solid var(--border);
      color: var(--text); padding: 10px; border-radius: 6px; font-size: 12px; transition: all 0.3s ease;
    }
    .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
      outline: none; border-color: var(--gold);
      box-shadow: 0 0 10px rgba(201, 162, 39, 0.2), inset 0 0 5px rgba(0,0,0,0.5);
    }
    .form-group textarea { min-height: 70px; resize: vertical; }
    .form-group .hint { font-size: 10px; color: var(--text-dim); margin-top: 4px; font-style: italic; }
    .form-group .error { font-size: 10px; color: #ff4444; margin-top: 4px; text-shadow: 0 0 5px rgba(255, 0, 0, 0.3); }
    .form-group.has-error input, .form-group.has-error textarea { border-color: var(--error); box-shadow: 0 0 10px rgba(139, 0, 0, 0.3); }
    .char-count { text-align: right; font-size: 10px; color: var(--text-dim); }
    .char-count.warning { color: var(--gold); text-shadow: 0 0 5px var(--gold); }
    .char-count.error { color: #ff4444; text-shadow: 0 0 5px #ff0000; }
    
    /* Action Type */
    .action-types { display: flex; gap: 10px; margin-bottom: 14px; }
    .action-type-btn {
      flex: 1; background: var(--bg); border: 1px solid var(--border);
      color: var(--text); padding: 10px; border-radius: 6px; cursor: pointer;
      text-align: center; font-size: 11px; transition: all 0.3s ease;
    }
    .action-type-btn.active {
      border-color: var(--gold);
      background: linear-gradient(180deg, var(--surface-light) 0%, var(--surface) 100%);
      box-shadow: 0 0 15px rgba(201, 162, 39, 0.2), inset 0 1px 0 rgba(255,255,255,0.05);
    }
    .config-section { display: none; }
    .config-section.active { display: block; animation: fadeIn 0.3s ease; }
    
    /* SUMMON BUTTON */
    .btn-summon {
      width: 100%;
      background: linear-gradient(135deg, #1a0a00 0%, #3a1a00 50%, #1a0a00 100%);
      border: 2px solid var(--gold); color: var(--gold); padding: 14px; border-radius: 8px;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;
      margin-top: 10px; position: relative; overflow: hidden;
      text-shadow: 0 0 10px var(--gold-glow); letter-spacing: 1px;
    }
    .btn-summon::before {
      content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
      background: conic-gradient(from 0deg, transparent, var(--gold-glow), transparent, var(--gold-glow), transparent);
      animation: rotate 4s linear infinite; opacity: 0; transition: opacity 0.3s;
    }
    .btn-summon:hover:not(:disabled)::before { opacity: 0.1; }
    .btn-summon:hover:not(:disabled) {
      box-shadow: 0 0 30px rgba(201, 162, 39, 0.4), 0 0 60px rgba(201, 162, 39, 0.2), inset 0 0 20px rgba(201, 162, 39, 0.1);
      transform: scale(1.02); text-shadow: 0 0 20px var(--gold-glow), 0 0 40px var(--gold-glow);
    }
    @keyframes rotate { 100% { transform: rotate(360deg); } }
    .btn-summon:disabled { background: var(--surface); border-color: var(--border); color: var(--text-dim); cursor: not-allowed; text-shadow: none; }
    .btn-summon.loading { color: transparent; text-shadow: none; }
    .btn-summon.loading::after {
      content: '🔮'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 20px; animation: pulse 1s ease-in-out infinite, spin 2s linear infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
    
    /* Messages */
    .message { padding: 12px; border-radius: 6px; margin-bottom: 14px; text-align: center; font-size: 11px; animation: messageAppear 0.5s ease; }
    @keyframes messageAppear { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
    .message.success { background: linear-gradient(135deg, rgba(46, 139, 87, 0.2) 0%, rgba(0, 50, 0, 0.3) 100%); border: 1px solid var(--success); color: #50fa7b; text-shadow: 0 0 10px rgba(80, 250, 123, 0.3); }
    .message.error { background: linear-gradient(135deg, rgba(139, 0, 0, 0.2) 0%, rgba(50, 0, 0, 0.3) 100%); border: 1px solid var(--error); color: #ff5555; text-shadow: 0 0 10px rgba(255, 0, 0, 0.3); }
    
    /* Preview */
    .preview-section { margin-top: 16px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--bg); }
    .preview-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: linear-gradient(180deg, var(--surface-light) 0%, var(--surface) 100%); cursor: pointer; user-select: none; transition: all 0.3s; }
    .preview-header:hover { background: var(--surface-light); }
    .preview-title { color: var(--gold); font-size: 11px; font-weight: 500; text-shadow: 0 0 5px rgba(201, 162, 39, 0.3); }
    .preview-toggle { color: var(--text-dim); font-size: 10px; transition: transform 0.3s; }
    .preview-section.collapsed .preview-toggle { transform: rotate(-90deg); }
    .preview-section.collapsed .preview-content { display: none; }
    .preview-content { background: #050305; padding: 12px; max-height: 300px; overflow-y: auto; border-top: 1px solid var(--border); }
    .preview-code { font-family: 'Consolas', 'Monaco', monospace; font-size: 10px; line-height: 1.5; color: var(--text); white-space: pre-wrap; word-break: break-all; }
    .preview-code .key { color: #bd93f9; }
    .preview-code .string { color: #f1fa8c; }
    .preview-code .number { color: #ff79c6; }
    .preview-code .boolean { color: #8be9fd; }
    .preview-code .null { color: #6272a4; }
    
    /* Parameter rows */
    .param-row, .header-row { display: flex; gap: 6px; margin-bottom: 8px; align-items: center; }
    .param-row input, .header-row input { flex: 1; padding: 8px; font-size: 11px; }
    .param-row select { width: 75px; padding: 8px; font-size: 11px; }
    .param-row input[type="checkbox"] { width: auto; flex: none; }
    .btn-small { background: var(--surface); border: 1px solid var(--border); color: var(--gold); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 10px; margin-left: 8px; transition: all 0.2s; }
    .btn-small:hover { border-color: var(--gold); box-shadow: 0 0 8px rgba(201, 162, 39, 0.3); }
    .btn-remove { background: transparent; border: none; color: #ff5555; cursor: pointer; padding: 4px; font-size: 14px; transition: all 0.2s; }
    .btn-remove:hover { text-shadow: 0 0 10px #ff0000; transform: scale(1.2); }
    
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--gold-dim); }
  </style>
</head>
<body>
  <div class="particles"><div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div></div>
  <div class="mist"></div>
  <div class="container">
    <div class="tabs">
      <button class="tab active" data-tab="spells">📜 My Spells</button>
      <button class="tab" data-tab="create">🕯️ Conjure</button>
    </div>
    <div class="tab-content">
      <div id="message" class="message" style="display: none;"></div>
      <div class="tab-pane active" id="spells-tab">
        <div class="spells-list" id="spells-list"><div class="empty-state">The grimoire awaits...<br>Conjure your first spell!</div></div>
      </div>
      <div class="tab-pane" id="create-tab">
        <div class="examples">
          <button class="example-btn" onclick="loadExample('github-fetcher')">🐙 GitHub</button>
          <button class="example-btn" onclick="loadExample('weather-api')">⛈️ Weather</button>
          <button class="example-btn" onclick="loadExample('calculator')">💀 Calc</button>
        </div>
        <div class="form-group" id="name-group">
          <label>🏷️ Spell Name</label>
          <input type="text" id="name" placeholder="dark-ritual" oninput="validateForm()">
          <div class="hint">kebab-case incantation, 3-50 runes</div>
          <div class="error" id="name-error"></div>
        </div>
        <div class="form-group" id="description-group">
          <label>📖 Ancient Description</label>
          <textarea id="description" placeholder="Describe the dark purpose of your spell..." oninput="validateForm()"></textarea>
          <div class="char-count" id="char-count">0/500</div>
          <div class="error" id="description-error"></div>
        </div>
        <div class="form-group">
          <label>⚗️ Ritual Type</label>
          <div class="action-types">
            <button class="action-type-btn active" id="http-btn" onclick="setActionType('http')">🌐 HTTP Séance</button>
            <button class="action-type-btn" id="script-btn" onclick="setActionType('script')">📜 Dark Script</button>
          </div>
        </div>
        <div class="form-group">
          <label>🔮 Ingredients <button class="btn-small" onclick="addParameter()">+ Add</button></label>
          <div id="parameters-list"></div>
          <div class="hint">Define the components for your ritual</div>
        </div>
        <div class="config-section active" id="http-config">
          <div class="form-group">
            <label>🔗 Portal URL</label>
            <input type="text" id="url" placeholder="https://api.underworld.com/{{soul}}" oninput="validateForm()">
            <div class="hint">Use {{ingredient}} for dark interpolation</div>
          </div>
          <div class="form-group">
            <label>📤 Invocation</label>
            <select id="method" onchange="toggleBodyField(); updatePreview()">
              <option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="PATCH">PATCH</option><option value="DELETE">DELETE</option>
            </select>
          </div>
          <div class="form-group" id="headers-group">
            <label>📨 Cursed Headers <button class="btn-small" onclick="addHeader()">+ Add</button></label>
            <div id="headers-list"></div>
          </div>
          <div class="form-group" id="body-group" style="display:none;">
            <label>⚰️ Payload</label>
            <textarea id="body" placeholder='{"sacrifice": "{{value}}"}' oninput="updatePreview()"></textarea>
          </div>
        </div>
        <div class="config-section" id="script-config">
          <div class="form-group">
            <label>💀 Necromantic Code <button class="btn-small" onclick="autoDetectParams()">👁️ Divine</button></label>
            <textarea id="code" placeholder="const { soul, power } = input;\\nreturn { darkness: soul * power };" oninput="validateForm()"></textarea>
          </div>
        </div>
        <div class="preview-section" id="preview-section">
          <div class="preview-header" onclick="togglePreview()">
            <span class="preview-title">🔮 Crystal Ball</span>
            <span class="preview-toggle">▼</span>
          </div>
          <div class="preview-content"><div class="preview-code" id="preview-code"><span class="null">Fill the form to preview your spell...</span></div></div>
        </div>
        <button class="btn-summon" id="summon-btn" onclick="summon()" disabled>🕯️ SUMMON FROM THE VOID 🕯️</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let actionType = 'http';
    let isValid = false;
    
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tabId + '-tab').classList.add('active');
      });
    });
    
    function setActionType(type) {
      actionType = type;
      document.getElementById('http-btn').classList.toggle('active', type === 'http');
      document.getElementById('script-btn').classList.toggle('active', type === 'script');
      document.getElementById('http-config').classList.toggle('active', type === 'http');
      document.getElementById('script-config').classList.toggle('active', type === 'script');
      validateForm();
    }
    
    function validateForm() {
      const description = document.getElementById('description').value;
      const charCount = document.getElementById('char-count');
      charCount.textContent = description.length + '/500';
      charCount.className = 'char-count';
      if (description.length < 100) charCount.classList.add('warning');
      else if (description.length > 500) charCount.classList.add('error');
      vscode.postMessage({ type: 'validate', data: getFormData() });
      updatePreview();
    }
    
    function getFormData() {
      return {
        name: document.getElementById('name').value,
        description: document.getElementById('description').value,
        actionType: actionType,
        url: document.getElementById('url').value,
        method: document.getElementById('method').value,
        headers: getHeaders(),
        body: document.getElementById('body')?.value || '',
        code: document.getElementById('code').value,
        parameters: getParameters()
      };
    }
    
    function getParameters() {
      const params = [];
      document.querySelectorAll('.param-row').forEach(row => {
        const name = row.querySelector('.param-name')?.value;
        const type = row.querySelector('.param-type')?.value || 'string';
        const required = row.querySelector('.param-required')?.checked || false;
        if (name) params.push({ name, type, required });
      });
      return params;
    }
    
    function getHeaders() {
      const headers = {};
      document.querySelectorAll('.header-row').forEach(row => {
        const key = row.querySelector('.header-key')?.value;
        const value = row.querySelector('.header-value')?.value;
        if (key) headers[key] = value || '';
      });
      return headers;
    }
    
    function addParameter() {
      const list = document.getElementById('parameters-list');
      const row = document.createElement('div');
      row.className = 'param-row';
      row.innerHTML = '<input type="text" class="param-name" placeholder="name" oninput="updatePreview()"><select class="param-type" onchange="updatePreview()"><option value="string">string</option><option value="number">number</option><option value="boolean">boolean</option></select><label><input type="checkbox" class="param-required" onchange="updatePreview()"> req</label><button class="btn-remove" onclick="this.parentElement.remove(); updatePreview()">×</button>';
      list.appendChild(row);
      updatePreview();
    }
    
    function autoDetectParams() {
      const code = document.getElementById('code').value;
      const detected = new Set();
      const destructureMatch = code.match(/const\\s*\\{([^}]+)\\}\\s*=\\s*input/);
      if (destructureMatch) destructureMatch[1].split(',').forEach(p => { const name = p.trim().split(':')[0].trim(); if (name) detected.add(name); });
      const dotMatches = code.matchAll(/input\\.([a-zA-Z_][a-zA-Z0-9_]*)/g);
      for (const match of dotMatches) detected.add(match[1]);
      if (detected.size === 0) { showMessage('No ingredients detected', 'error'); return; }
      const existing = new Set(getParameters().map(p => p.name));
      const list = document.getElementById('parameters-list');
      let added = 0;
      detected.forEach(name => {
        if (!existing.has(name)) {
          const row = document.createElement('div');
          row.className = 'param-row';
          row.innerHTML = '<input type="text" class="param-name" value="' + name + '" oninput="updatePreview()"><select class="param-type"><option value="string">string</option><option value="number">number</option><option value="boolean">boolean</option></select><label><input type="checkbox" class="param-required" checked> req</label><button class="btn-remove" onclick="this.parentElement.remove(); updatePreview()">×</button>';
          list.appendChild(row);
          added++;
        }
      });
      if (added > 0) { showMessage('👁️ Divined ' + added + ' ingredient(s)', 'success'); updatePreview(); validateForm(); }
      else showMessage('All ingredients already bound', 'error');
    }
    
    function addHeader() {
      const list = document.getElementById('headers-list');
      const row = document.createElement('div');
      row.className = 'header-row';
      row.innerHTML = '<input type="text" class="header-key" placeholder="Authorization" oninput="updatePreview()"><input type="text" class="header-value" placeholder="Bearer {{apiKey}}" oninput="updatePreview()"><button class="btn-remove" onclick="this.parentElement.remove(); updatePreview()">×</button>';
      list.appendChild(row);
    }
    
    function toggleBodyField() {
      const method = document.getElementById('method').value;
      document.getElementById('body-group').style.display = ['POST', 'PUT', 'PATCH'].includes(method) ? 'block' : 'none';
    }
    
    function summon() {
      const btn = document.getElementById('summon-btn');
      btn.classList.add('loading');
      btn.disabled = true;
      vscode.postMessage({ type: 'generate', data: getFormData() });
    }
    
    function loadExample(name) { vscode.postMessage({ type: 'loadExample', example: name }); }
    function togglePreview() { document.getElementById('preview-section').classList.toggle('collapsed'); }
    
    function updatePreview() {
      const data = getFormData();
      const inputSchema = { type: 'object', properties: {} };
      const required = [];
      if (data.parameters) data.parameters.forEach(p => { if (p.name) { inputSchema.properties[p.name] = { type: p.type || 'string' }; if (p.required) required.push(p.name); } });
      if (required.length > 0) inputSchema.required = required;
      const spell = { name: data.name || 'dark-spell', description: data.description || '...', inputSchema, action: {} };
      if (data.actionType === 'http') {
        spell.action = { type: 'http', config: { url: data.url || 'https://...', method: data.method || 'GET' } };
        if (data.headers && Object.keys(data.headers).length > 0) spell.action.config.headers = data.headers;
        if (data.body && ['POST', 'PUT', 'PATCH'].includes(data.method)) spell.action.config.body = data.body;
      } else {
        spell.action = { type: 'script', config: { runtime: 'node', code: data.code || '// ...' } };
      }
      document.getElementById('preview-code').innerHTML = syntaxHighlight(JSON.stringify(spell, null, 2));
    }
    
    function syntaxHighlight(json) {
      return json.replace(/("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g, function (match) {
        let cls = 'number';
        if (/^"/.test(match)) { cls = /:$/.test(match) ? 'key' : 'string'; }
        else if (/true|false/.test(match)) cls = 'boolean';
        else if (/null/.test(match)) cls = 'null';
        return '<span class="' + cls + '">' + match + '</span>';
      });
    }
    
    function showMessage(text, type) {
      const msg = document.getElementById('message');
      msg.textContent = text;
      msg.className = 'message ' + type;
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 4000);
    }
    
    function renderSpells(spells) {
      const list = document.getElementById('spells-list');
      if (spells.length === 0) { list.innerHTML = '<div class="empty-state">The grimoire awaits...<br>Conjure your first spell!</div>'; return; }
      list.innerHTML = spells.map(spell => '<div class="spell-item" onclick="openSpell(\\'' + spell.path.replace(/\\\\/g, '\\\\\\\\') + '\\')"><div class="spell-name">👻 ' + spell.name + '</div><div class="spell-desc">' + spell.description + '</div></div>').join('');
    }
    
    function openSpell(path) { vscode.postMessage({ type: 'openSpell', path: path }); }
    
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'validationResult':
          document.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
          document.querySelectorAll('.error').forEach(e => e.textContent = '');
          message.errors.forEach(err => {
            const group = document.getElementById(err.field + '-group');
            const errorEl = document.getElementById(err.field + '-error');
            if (group) group.classList.add('has-error');
            if (errorEl) errorEl.textContent = err.message;
          });
          isValid = message.errors.length === 0;
          document.getElementById('summon-btn').disabled = !isValid;
          break;
        case 'generateResult':
          document.getElementById('summon-btn').classList.remove('loading');
          document.getElementById('summon-btn').disabled = !isValid;
          showMessage(message.message, message.success ? 'success' : 'error');
          break;
        case 'exampleLoaded':
          document.getElementById('name').value = message.data.name;
          document.getElementById('description').value = message.data.description;
          setActionType(message.data.actionType);
          document.getElementById('url').value = message.data.url || '';
          document.getElementById('method').value = message.data.method || 'GET';
          document.getElementById('code').value = message.data.code || '';
          const paramsList = document.getElementById('parameters-list');
          paramsList.innerHTML = '';
          if (message.data.parameters) message.data.parameters.forEach(p => {
            const row = document.createElement('div');
            row.className = 'param-row';
            row.innerHTML = '<input type="text" class="param-name" value="' + p.name + '"><select class="param-type"><option value="string"' + (p.type === 'string' ? ' selected' : '') + '>string</option><option value="number"' + (p.type === 'number' ? ' selected' : '') + '>number</option><option value="boolean"' + (p.type === 'boolean' ? ' selected' : '') + '>boolean</option></select><label><input type="checkbox" class="param-required"' + (p.required ? ' checked' : '') + '> req</label><button class="btn-remove" onclick="this.parentElement.remove(); updatePreview()">×</button>';
            paramsList.appendChild(row);
          });
          validateForm();
          break;
        case 'spellsList': renderSpells(message.spells); break;
        case 'tabChanged':
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
          document.querySelector('[data-tab="' + message.tab + '"]').classList.add('active');
          document.getElementById(message.tab + '-tab').classList.add('active');
          break;
      }
    });
    
    vscode.postMessage({ type: 'getSpells' });
  </script>
</body>
</html>`;
  }
}
