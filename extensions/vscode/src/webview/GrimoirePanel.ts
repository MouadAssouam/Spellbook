// kiro-generated
/**
 * Grimoire Panel - Visual Spell Builder
 * 
 * A webview-based UI for creating MCP tools with a mystical grimoire theme.
 * Features real-time validation, code preview, and example spell loading.
 */

import * as vscode from 'vscode';
import { generateMCPServer, validateSpell } from '@spellbook/core';
import { randomUUID } from 'crypto';
import { log, logSpellCreation, logSuccess, error } from '../utils/logger';
import { examples, ExampleSpell } from '../utils/examples';

export class GrimoirePanel {
  public static currentPanel: GrimoirePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel exists, show it
    if (GrimoirePanel.currentPanel) {
      GrimoirePanel.currentPanel._panel.reveal(column);
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'spellbookGrimoire',
      '🔮 Spellbook Grimoire',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    GrimoirePanel.currentPanel = new GrimoirePanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set webview content
    this._panel.webview.html = this._getHtmlForWebview();

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      message => this._handleMessage(message),
      null,
      this._disposables
    );

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    log('🔮 Grimoire panel opened');
  }

  public dispose() {
    GrimoirePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
    log('📜 Grimoire panel closed');
  }

  private async _handleMessage(message: any) {
    switch (message.type) {
      case 'validate':
        this._handleValidate(message.data);
        break;
      case 'preview':
        this._handlePreview(message.data);
        break;
      case 'generate':
        await this._handleGenerate(message.data);
        break;
      case 'loadExample':
        this._handleLoadExample(message.example);
        break;
    }
  }

  private _handleValidate(data: any) {
    const errors: Array<{ field: string; message: string }> = [];

    // Validate name
    if (!data.name || data.name.length < 3) {
      errors.push({ field: 'name', message: 'Name must be at least 3 characters' });
    } else if (data.name.length > 50) {
      errors.push({ field: 'name', message: 'Name must be at most 50 characters' });
    } else if (!/^[a-zA-Z0-9-]+$/.test(data.name)) {
      errors.push({ field: 'name', message: 'Name must be kebab-case (letters, numbers, hyphens)' });
    }

    // Validate description
    if (!data.description || data.description.length < 100) {
      errors.push({ field: 'description', message: `Description must be at least 100 characters (${data.description?.length || 0}/100)` });
    } else if (data.description.length > 500) {
      errors.push({ field: 'description', message: 'Description must be at most 500 characters' });
    }

    // Validate URL for HTTP actions
    if (data.actionType === 'http' && data.url) {
      try {
        // Allow template variables in URL
        const testUrl = data.url.replace(/\{\{[^}]+\}\}/g, 'placeholder');
        new URL(testUrl);
      } catch {
        errors.push({ field: 'url', message: 'Invalid URL format' });
      }
    }

    // Validate code for script actions
    if (data.actionType === 'script' && (!data.code || data.code.trim().length === 0)) {
      errors.push({ field: 'code', message: 'Script code is required' });
    }

    this._panel.webview.postMessage({ type: 'validationResult', errors });
  }

  private _handlePreview(data: any) {
    try {
      const spell = this._buildSpell(data);
      const files = generateMCPServer(spell);
      this._panel.webview.postMessage({ type: 'previewResult', files });
    } catch (err) {
      this._panel.webview.postMessage({ 
        type: 'previewResult', 
        error: err instanceof Error ? err.message : 'Preview failed' 
      });
    }
  }

  private async _handleGenerate(data: any) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this._panel.webview.postMessage({ 
        type: 'generateResult', 
        success: false, 
        message: 'Please open a folder first' 
      });
      return;
    }

    try {
      const spell = this._buildSpell(data);
      logSpellCreation(spell.name, spell.action.type);

      // Check for existing spell
      const spellDir = vscode.Uri.joinPath(workspaceFolder.uri, spell.name);
      try {
        await vscode.workspace.fs.stat(spellDir);
        this._panel.webview.postMessage({ 
          type: 'generateResult', 
          success: false, 
          message: `Spell "${spell.name}" already exists. Choose a different name.` 
        });
        return;
      } catch {
        // Directory doesn't exist - good
      }

      // Generate files
      const files = generateMCPServer(spell);
      await vscode.workspace.fs.createDirectory(spellDir);

      for (const [filename, content] of Object.entries(files)) {
        const fileUri = vscode.Uri.joinPath(spellDir, filename);
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content as string, 'utf8'));
      }

      logSuccess(spell.name, spellDir.fsPath);

      this._panel.webview.postMessage({ 
        type: 'generateResult', 
        success: true, 
        message: `✨ Spell "${spell.name}" summoned successfully!`,
        spellPath: spellDir.fsPath
      });

    } catch (err) {
      error('Failed to generate spell', err instanceof Error ? err : undefined);
      this._panel.webview.postMessage({ 
        type: 'generateResult', 
        success: false, 
        message: err instanceof Error ? err.message : 'Generation failed' 
      });
    }
  }

  private _handleLoadExample(exampleName: string) {
    const example = examples[exampleName];
    
    if (example) {
      this._panel.webview.postMessage({ 
        type: 'exampleLoaded', 
        data: {
          name: example.name,
          description: example.description,
          actionType: example.action.type,
          url: example.action.type === 'http' ? example.action.config.url : '',
          method: example.action.type === 'http' ? example.action.config.method : 'GET',
          headers: example.action.type === 'http' ? example.action.config.headers : {},
          body: example.action.type === 'http' ? example.action.config.body : '',
          code: example.action.type === 'script' ? example.action.config.code : ''
        }
      });
    }
  }

  private _buildSpell(data: any) {
    const action = data.actionType === 'http' 
      ? {
          type: 'http' as const,
          config: {
            url: data.url,
            method: data.method || 'GET',
            ...(data.headers && Object.keys(data.headers).length > 0 && { headers: data.headers }),
            ...(data.body && { body: data.body })
          }
        }
      : {
          type: 'script' as const,
          config: {
            runtime: 'node' as const,
            code: data.code
          }
        };

    return {
      id: randomUUID(),
      name: data.name,
      description: data.description,
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      action
    };
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spellbook Grimoire</title>
  <style>
    :root {
      --grimoire-bg: #1a120b;
      --grimoire-surface: #2d1f14;
      --grimoire-surface-light: #3d2a1a;
      --grimoire-gold: #d4af37;
      --grimoire-gold-dim: #8b7355;
      --grimoire-text: #f4e8d8;
      --grimoire-text-dim: #a89880;
      --grimoire-error: #ff6b6b;
      --grimoire-success: #4ecdc4;
      --grimoire-border: #4a3728;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--grimoire-bg);
      color: var(--grimoire-text);
      padding: 20px;
      min-height: 100vh;
    }
    
    .grimoire-container {
      max-width: 800px;
      margin: 0 auto;
    }
    
    .grimoire-header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid var(--grimoire-gold-dim);
    }
    
    .grimoire-header h1 {
      font-size: 2.5em;
      color: var(--grimoire-gold);
      text-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
      margin-bottom: 10px;
    }
    
    .grimoire-header p {
      color: var(--grimoire-text-dim);
      font-style: italic;
    }
    
    .examples-section {
      margin-bottom: 30px;
    }
    
    .examples-section h3 {
      color: var(--grimoire-gold);
      margin-bottom: 15px;
      font-size: 1.1em;
    }
    
    .example-buttons {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .example-btn {
      background: var(--grimoire-surface);
      border: 1px solid var(--grimoire-border);
      color: var(--grimoire-text);
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .example-btn:hover {
      background: var(--grimoire-surface-light);
      border-color: var(--grimoire-gold);
      box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
    }
    
    .form-section {
      background: var(--grimoire-surface);
      border: 1px solid var(--grimoire-border);
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      color: var(--grimoire-gold);
      margin-bottom: 8px;
      font-weight: 500;
    }
    
    .form-group input,
    .form-group textarea,
    .form-group select {
      width: 100%;
      background: var(--grimoire-bg);
      border: 1px solid var(--grimoire-border);
      color: var(--grimoire-text);
      padding: 12px;
      border-radius: 6px;
      font-size: 14px;
    }
    
    .form-group input:focus,
    .form-group textarea:focus,
    .form-group select:focus {
      outline: none;
      border-color: var(--grimoire-gold);
      box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
    }
    
    .form-group textarea {
      min-height: 100px;
      resize: vertical;
    }
    
    .form-group .hint {
      font-size: 12px;
      color: var(--grimoire-text-dim);
      margin-top: 5px;
    }
    
    .form-group .error {
      font-size: 12px;
      color: var(--grimoire-error);
      margin-top: 5px;
    }
    
    .form-group.has-error input,
    .form-group.has-error textarea {
      border-color: var(--grimoire-error);
    }
    
    .char-count {
      text-align: right;
      font-size: 12px;
      color: var(--grimoire-text-dim);
    }
    
    .char-count.warning { color: var(--grimoire-gold); }
    .char-count.error { color: var(--grimoire-error); }
    
    .action-type-selector {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .action-type-btn {
      flex: 1;
      background: var(--grimoire-bg);
      border: 2px solid var(--grimoire-border);
      color: var(--grimoire-text);
      padding: 15px;
      border-radius: 8px;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
    }
    
    .action-type-btn.active {
      border-color: var(--grimoire-gold);
      background: var(--grimoire-surface-light);
    }
    
    .action-type-btn:hover {
      border-color: var(--grimoire-gold-dim);
    }
    
    .action-type-btn .icon {
      font-size: 24px;
      margin-bottom: 5px;
    }
    
    .http-config, .script-config {
      display: none;
    }
    
    .http-config.active, .script-config.active {
      display: block;
    }
    
    .preview-section {
      background: var(--grimoire-surface);
      border: 1px solid var(--grimoire-border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      display: none;
    }
    
    .preview-section.active {
      display: block;
    }
    
    .preview-tabs {
      display: flex;
      gap: 5px;
      margin-bottom: 15px;
      border-bottom: 1px solid var(--grimoire-border);
      padding-bottom: 10px;
    }
    
    .preview-tab {
      background: transparent;
      border: none;
      color: var(--grimoire-text-dim);
      padding: 8px 15px;
      cursor: pointer;
      border-radius: 4px;
    }
    
    .preview-tab.active {
      background: var(--grimoire-surface-light);
      color: var(--grimoire-gold);
    }
    
    .preview-content {
      background: var(--grimoire-bg);
      border-radius: 6px;
      padding: 15px;
      overflow-x: auto;
    }
    
    .preview-content pre {
      margin: 0;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
    }
    
    .actions {
      display: flex;
      gap: 15px;
      justify-content: center;
    }
    
    .btn {
      padding: 15px 30px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    
    .btn-preview {
      background: var(--grimoire-surface);
      border: 2px solid var(--grimoire-gold-dim);
      color: var(--grimoire-text);
    }
    
    .btn-preview:hover {
      border-color: var(--grimoire-gold);
    }
    
    .btn-summon {
      background: linear-gradient(135deg, var(--grimoire-gold), #b8962e);
      color: var(--grimoire-bg);
    }
    
    .btn-summon:hover {
      box-shadow: 0 0 20px rgba(212, 175, 55, 0.4);
      transform: translateY(-2px);
    }
    
    .btn-summon:disabled {
      background: var(--grimoire-gold-dim);
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    
    .btn-summon.loading {
      position: relative;
      color: transparent;
    }
    
    .btn-summon.loading::after {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      top: 50%;
      left: 50%;
      margin: -10px 0 0 -10px;
      border: 3px solid var(--grimoire-bg);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .message {
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: center;
    }
    
    .message.success {
      background: rgba(78, 205, 196, 0.2);
      border: 1px solid var(--grimoire-success);
      color: var(--grimoire-success);
    }
    
    .message.error {
      background: rgba(255, 107, 107, 0.2);
      border: 1px solid var(--grimoire-error);
      color: var(--grimoire-error);
    }
    
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid var(--grimoire-border);
      color: var(--grimoire-text-dim);
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="grimoire-container">
    <header class="grimoire-header">
      <h1>🔮 Spellbook Grimoire</h1>
      <p>Summon MCP tools with ancient wisdom</p>
    </header>
    
    <div id="message" class="message" style="display: none;"></div>
    
    <section class="examples-section">
      <h3>📚 Example Spells</h3>
      <div class="example-buttons">
        <button class="example-btn" onclick="loadExample('github-fetcher')">🐙 GitHub Fetcher</button>
        <button class="example-btn" onclick="loadExample('weather-api')">🌤️ Weather API</button>
        <button class="example-btn" onclick="loadExample('calculator')">🧮 Calculator</button>
      </div>
    </section>
    
    <section class="form-section">
      <div class="form-group" id="name-group">
        <label>📛 Spell Name</label>
        <input type="text" id="name" placeholder="my-awesome-tool" oninput="validateForm()">
        <div class="hint">Kebab-case, 3-50 characters (e.g., github-fetcher)</div>
        <div class="error" id="name-error"></div>
      </div>
      
      <div class="form-group" id="description-group">
        <label>📝 Description</label>
        <textarea id="description" placeholder="Describe what your spell does..." oninput="validateForm()"></textarea>
        <div class="char-count" id="char-count">0/500</div>
        <div class="error" id="description-error"></div>
      </div>
      
      <div class="form-group">
        <label>⚡ Action Type</label>
        <div class="action-type-selector">
          <button class="action-type-btn active" id="http-btn" onclick="setActionType('http')">
            <div class="icon">🌐</div>
            <div>HTTP Request</div>
          </button>
          <button class="action-type-btn" id="script-btn" onclick="setActionType('script')">
            <div class="icon">📜</div>
            <div>JavaScript</div>
          </button>
        </div>
      </div>
      
      <div class="http-config active" id="http-config">
        <div class="form-group">
          <label>🔗 URL</label>
          <input type="text" id="url" placeholder="https://api.example.com/{{resource}}" oninput="validateForm()">
          <div class="hint">Use {{variable}} for template placeholders</div>
        </div>
        
        <div class="form-group">
          <label>📤 Method</label>
          <select id="method">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>
      
      <div class="script-config" id="script-config">
        <div class="form-group">
          <label>💻 JavaScript Code</label>
          <textarea id="code" placeholder="const { input } = input;&#10;return { result: input * 2 };" oninput="validateForm()"></textarea>
          <div class="hint">Receives 'input' object, must return result</div>
        </div>
      </div>
    </section>
    
    <section class="preview-section" id="preview-section">
      <div class="preview-tabs">
        <button class="preview-tab active" onclick="showPreviewTab('Dockerfile')">Dockerfile</button>
        <button class="preview-tab" onclick="showPreviewTab('package.json')">package.json</button>
        <button class="preview-tab" onclick="showPreviewTab('index.js')">index.js</button>
        <button class="preview-tab" onclick="showPreviewTab('README.md')">README.md</button>
      </div>
      <div class="preview-content">
        <pre id="preview-code"></pre>
      </div>
    </section>
    
    <div class="actions">
      <button class="btn btn-preview" onclick="preview()">👁️ Preview</button>
      <button class="btn btn-summon" id="summon-btn" onclick="summon()" disabled>✨ Summon Spell</button>
    </div>
    
    <footer class="footer">
      🔮 Spellbook - Build MCP tools in seconds
    </footer>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    let actionType = 'http';
    let previewFiles = {};
    let isValid = false;
    
    function setActionType(type) {
      actionType = type;
      document.getElementById('http-btn').classList.toggle('active', type === 'http');
      document.getElementById('script-btn').classList.toggle('active', type === 'script');
      document.getElementById('http-config').classList.toggle('active', type === 'http');
      document.getElementById('script-config').classList.toggle('active', type === 'script');
      validateForm();
    }
    
    function validateForm() {
      const name = document.getElementById('name').value;
      const description = document.getElementById('description').value;
      
      // Update char count
      const charCount = document.getElementById('char-count');
      charCount.textContent = description.length + '/500';
      charCount.className = 'char-count';
      if (description.length < 100) charCount.classList.add('warning');
      else if (description.length > 500) charCount.classList.add('error');
      
      // Send validation request
      vscode.postMessage({
        type: 'validate',
        data: getFormData()
      });
    }
    
    function getFormData() {
      return {
        name: document.getElementById('name').value,
        description: document.getElementById('description').value,
        actionType: actionType,
        url: document.getElementById('url').value,
        method: document.getElementById('method').value,
        code: document.getElementById('code').value
      };
    }
    
    function preview() {
      vscode.postMessage({
        type: 'preview',
        data: getFormData()
      });
    }
    
    function showPreviewTab(filename) {
      document.querySelectorAll('.preview-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent === filename);
      });
      document.getElementById('preview-code').textContent = previewFiles[filename] || '';
    }
    
    function summon() {
      const btn = document.getElementById('summon-btn');
      btn.classList.add('loading');
      btn.disabled = true;
      
      vscode.postMessage({
        type: 'generate',
        data: getFormData()
      });
    }
    
    function loadExample(name) {
      vscode.postMessage({
        type: 'loadExample',
        example: name
      });
    }
    
    function showMessage(text, type) {
      const msg = document.getElementById('message');
      msg.textContent = text;
      msg.className = 'message ' + type;
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 5000);
    }
    
    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'validationResult':
          handleValidationResult(message.errors);
          break;
        case 'previewResult':
          handlePreviewResult(message);
          break;
        case 'generateResult':
          handleGenerateResult(message);
          break;
        case 'exampleLoaded':
          handleExampleLoaded(message.data);
          break;
      }
    });
    
    function handleValidationResult(errors) {
      // Clear previous errors
      document.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
      document.querySelectorAll('.error').forEach(e => e.textContent = '');
      
      // Show new errors
      errors.forEach(err => {
        const group = document.getElementById(err.field + '-group');
        const errorEl = document.getElementById(err.field + '-error');
        if (group) group.classList.add('has-error');
        if (errorEl) errorEl.textContent = err.message;
      });
      
      // Update button state
      isValid = errors.length === 0;
      document.getElementById('summon-btn').disabled = !isValid;
    }
    
    function handlePreviewResult(message) {
      if (message.error) {
        showMessage(message.error, 'error');
        return;
      }
      
      previewFiles = message.files;
      document.getElementById('preview-section').classList.add('active');
      showPreviewTab('Dockerfile');
    }
    
    function handleGenerateResult(message) {
      const btn = document.getElementById('summon-btn');
      btn.classList.remove('loading');
      btn.disabled = !isValid;
      
      showMessage(message.message, message.success ? 'success' : 'error');
    }
    
    function handleExampleLoaded(data) {
      document.getElementById('name').value = data.name;
      document.getElementById('description').value = data.description;
      setActionType(data.actionType);
      document.getElementById('url').value = data.url || '';
      document.getElementById('method').value = data.method || 'GET';
      document.getElementById('code').value = data.code || '';
      validateForm();
    }
  </script>
</body>
</html>`;
  }
}
