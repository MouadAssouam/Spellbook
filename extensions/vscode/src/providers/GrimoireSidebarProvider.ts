/**
 * Grimoire Sidebar Provider - HAUNTED EDITION 
 * 
 * Embeds the spell builder directly in the VS Code sidebar using WebviewViewProvider.
 * Features tabbed interface with spooky animations, floating particles, and eerie glows.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  generateMCPServerV2,
  inferSchema,
  extractUrlParameters,
  type JSONSchema,
  parseOpenApiSpec,
  magicFromUrl,
  WatchManager,
  type WatchConfig,
  type SchemaChange,
  bulkTestTools,
  type BulkTestTool,
  type BulkTestOptions
} from '@spellbook/core';
import { randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { log, logSpellCreation, logSuccess, error } from '../utils/logger';
import { examples } from '../utils/examples';

interface SpellInfo {
  name: string;
  description: string;
  path: string;
}

interface WatchState {
  watching: boolean;
  changes: SchemaChange[];
  config?: WatchConfig;
  /** Auth env var name (NOT the resolved token) - for secure persistence */
  authEnvVar?: string;
  /** Auth type for resolving the env var */
  authType?: 'bearer' | 'api-key';
}

interface EditSpellData {
  spellPath: string;
  name: string;
  description: string;
  transport: 'stdio' | 'sse';
  authType?: 'apiKey' | 'bearer' | 'oauth2' | '';
  authEnvVar?: string;
  oauthConfig?: {
    clientId?: string;
    clientSecret?: string;
    authUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
  };
  tools: Array<{
    name: string;
    description: string;
    actionType: 'http';
    method: string;
    url: string;
    parameters: Array<{ name: string; type: string; required: boolean }>;
  }>;
}

export class GrimoireSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'spellbook.grimoireView';
  private static readonly WATCH_STORAGE_KEY = 'spellbook.watchedSpells';

  private _view?: vscode.WebviewView;
  private _panelWebview?: vscode.Webview;
  private _extensionUri: vscode.Uri;
  private _context: vscode.ExtensionContext;
  private _watchManager: WatchManager;
  private _watchedSpells: Map<string, WatchState> = new Map();

  constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._extensionUri = extensionUri;
    this._context = context;
    this._watchManager = new WatchManager();

    // Set up change callback
    this._watchManager.onChange((changes: any[]) => {
      this._handleWatchChanges(changes);
    });

    // Restore persisted watches
    this._restoreWatches();
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
    webviewView.webview.onDidReceiveMessage(message => this._handleMessage(message, webviewView.webview));
    this._sendSpellsList();
    log(' Haunted Grimoire sidebar opened');
  }

  public refresh(): void {
    if (this._view) {
      this._sendSpellsList();
    }
  }

  public switchToSpellsTab(): void {
    this._postMessage({ type: 'tabChanged', tab: 'spells' });
  }

  public attachPanelWebview(panelWebview: vscode.Webview): vscode.Disposable {
    this._panelWebview = panelWebview;

    panelWebview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    panelWebview.html = this._getHtmlForWebview();

    const disposable = panelWebview.onDidReceiveMessage(message => this._handleMessage(message, panelWebview));

    // Initialize panel view with current state
    void this._sendSpellsList(panelWebview);
    void this._sendWatchState(panelWebview);

    log(' Grimoire panel attached to sidebar controller');

    return disposable;
  }

  public detachPanelWebview(panelWebview: vscode.Webview): void {
    if (this._panelWebview === panelWebview) {
      this._panelWebview = undefined;
    }
  }

  private _postMessage(message: any, target?: vscode.Webview): void {
    const send = (webview?: vscode.Webview) => {
      if (!webview) return;
      try {
        webview.postMessage(message);
      } catch {
        // ignore postMessage errors (e.g. disposed webview)
      }
    };

    if (target) {
      send(target);
      return;
    }

    send(this._view?.webview);
    send(this._panelWebview);
  }


  private async _handleMessage(message: any, target?: vscode.Webview) {
    switch (message.type) {
      case 'validate':
        this._handleValidate(message.data, target);
        break;
      case 'generate':
        await this._handleGenerate(message.data, target);
        break;
      case 'updateSpell':
        await this._handleUpdateSpell(message.data, message.spellPath, target);
        break;
      case 'copyConfig':
        await this._handleCopyConfig(message.data, target);
        break;
      case 'editSpell':
        await this._handleEditSpell(message.spellPath, target);
        break;
      case 'loadExample':
        this._handleLoadExample(message.example, target);
        break;
      case 'getSpells':
        this._sendSpellsList(target);
        this._sendWatchState(target);
        break;
      case 'openSpell':
        this._openSpellFolder(message.path);
        break;
      case 'testApi':
        await this._handleTestApi(message.data, target);
        break;
      case 'importOpenAPI':
        await this._handleImportOpenAPI(message.data, target);
        break;
      case 'magic':
        await this._handleMagic(message.data, target);
        break;
      case 'bulkTest':
        await this._handleBulkTest(message.data, target);
        break;
      // Watch Mode handlers
      case 'startWatch':
        await this._handleStartWatch(message.spellName, message.spellPath);
        break;
      case 'stopWatch':
        this._handleStopWatch(message.spellName);
        break;
      case 'acknowledgeWatchChanges':
        this._handleAcknowledgeChanges(message.spellName);
        break;
    }
  }

  private _handleValidate(data: any, target?: vscode.Webview) {
    const errors: Array<{ field: string; message: string }> = [];

    // validate spell details
    if (!data.name || data.name.length < 3) {
      errors.push({ field: 'name', message: 'Min 3 chars' });
    } else if (data.name.length > 50) {
      errors.push({ field: 'name', message: 'Max 50 chars' });
    } else if (!/^[a-zA-Z0-9-]+$/.test(data.name)) {
      errors.push({ field: 'name', message: 'Kebab-case only' });
    }

    if (!data.description || data.description.length < 100) {
      errors.push({ field: 'description', message: `${data.description?.length || 0}/100 min` });
    } else if (data.description.length > 500) {
      errors.push({ field: 'description', message: 'Max 500 chars' });
    }

    // validate auth
    if (data.authType) {
      if (!data.authEnvVar && data.authType !== 'oauth2') {
        // OAuth can optionally use default ENV var, others need it
        errors.push({ field: 'auth-env', message: 'Required' });
      }

      if (data.authType === 'oauth2') {
        const oauth = data.oauthConfig || {};
        if (!oauth.clientId) errors.push({ field: 'oauth-client-id', message: 'Required' });
        if (!oauth.clientSecret) errors.push({ field: 'oauth-client-secret', message: 'Required' });
        if (!oauth.authUrl) errors.push({ field: 'oauth-auth-url', message: 'Required' });
        if (!oauth.tokenUrl) errors.push({ field: 'oauth-token-url', message: 'Required' });
      }
    }

    // validate tools
    if (!data.tools || data.tools.length === 0) {
      errors.push({ field: 'general', message: 'At least one tool required' });
    } else {
      data.tools.forEach((tool: any, index: number) => {
        const prefix = `tool-${index}`;
        if (!tool.name || tool.name.length < 3) errors.push({ field: `${prefix}-name`, message: 'Min 3 chars' });
        if (!tool.description) errors.push({ field: `${prefix}-desc`, message: 'Required' });

        if (tool.actionType === 'http') {
          if (!tool.url || tool.url.trim().length === 0) {
            errors.push({ field: `${prefix}-url`, message: 'URL is required' });
          } else {
            try {
              // Basic URL check (allow placeholders)
              const testUrl = tool.url.replace(/\{\{[^}]+\}\}/g, 'placeholder');
              new URL(testUrl);
            } catch {
              errors.push({ field: `${prefix}-url`, message: 'Invalid URL' });
            }
          }
        }

        if (tool.actionType === 'script' && (!tool.code || tool.code.trim().length === 0)) {
          errors.push({ field: `${prefix}-code`, message: 'Required' });
        }
      });
    }

    this._postMessage({ type: 'validationResult', errors }, target);
  }

  private async _handleGenerate(data: any, target?: vscode.Webview) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this._postMessage({ type: 'generateResult', success: false, message: 'Open a folder first' }, target);
      return;
    }

    try {
      const spell = this._buildSpell(data);
      logSpellCreation(spell.name, spell.tools[0].action.type);

      const spellDir = vscode.Uri.joinPath(workspaceFolder.uri, spell.name);

      try {
        await vscode.workspace.fs.stat(spellDir);
        this._postMessage({ type: 'generateResult', success: false, message: `"${spell.name}" already exists` }, target);
        return;
      } catch {
        // Good - doesn't exist
      }

      const files = generateMCPServerV2(spell);
      await vscode.workspace.fs.createDirectory(spellDir);

      for (const [filename, content] of Object.entries(files)) {
        const fileUri = vscode.Uri.joinPath(spellDir, filename);
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content as string, 'utf8'));
      }

      let autoRegisterNote = '';
      if (data?.autoRegister) {
        const result = await this._autoRegisterToMcp(spell.name, workspaceFolder.uri, data.mcpTarget);
        autoRegisterNote = result.ok
          ? ` Auto-registered to: ${result.path}`
          : ` Could not auto-register: ${result.error}`;
      }

      logSuccess(spell.name, spellDir.fsPath);
      this._postMessage({
        type: 'generateResult',
        success: true,
        message: ` "${spell.name}" risen from the void!${autoRegisterNote}`
      }, target);
      this._sendSpellsList();
      this.switchToSpellsTab();

    } catch (err) {
      error('Failed to generate spell', err instanceof Error ? err : undefined);
      this._postMessage({ type: 'generateResult', success: false, message: err instanceof Error ? err.message : 'Generation failed' }, target);
    }
  }

  private async _handleUpdateSpell(data: any, spellPath: string | undefined, target?: vscode.Webview) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this._postMessage({ type: 'generateResult', success: false, message: 'Open a folder first' }, target);
      return;
    }

    try {
      const spell = this._buildSpell(data);
      const resolvedPath = spellPath || path.join(workspaceFolder.uri.fsPath, spell.name);
      const spellDir = vscode.Uri.file(resolvedPath);

      try {
        await vscode.workspace.fs.stat(spellDir);
      } catch {
        this._postMessage({ type: 'generateResult', success: false, message: 'Spell folder not found' }, target);
        return;
      }

      const files = generateMCPServerV2(spell);
      for (const [filename, content] of Object.entries(files)) {
        const fileUri = vscode.Uri.joinPath(spellDir, filename);
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content as string, 'utf8'));
      }

      let autoRegisterNote = '';
      if (data?.autoRegister) {
        const result = await this._autoRegisterToMcp(spell.name, workspaceFolder.uri, data.mcpTarget);
        autoRegisterNote = result.ok
          ? ` Auto-registered to: ${result.path}`
          : ` Could not auto-register: ${result.error}`;
      }

      logSuccess(spell.name, spellDir.fsPath);
      this._postMessage({
        type: 'generateResult',
        success: true,
        message: ` "${spell.name}" updated successfully!${autoRegisterNote}`
      }, target);
      this._sendSpellsList();
      this.switchToSpellsTab();
    } catch (err) {
      error('Failed to update spell', err instanceof Error ? err : undefined);
      this._postMessage({
        type: 'generateResult',
        success: false,
        message: err instanceof Error ? err.message : 'Update failed'
      }, target);
    }
  }

  private async _handleEditSpell(spellPath: string | undefined, target?: vscode.Webview) {
    if (!spellPath) {
      this._postMessage({ type: 'editSpellError', message: 'Spell path not provided' }, target);
      return;
    }

    try {
      const data = await this._loadSpellForEdit(spellPath);
      this._postMessage({ type: 'editSpellLoaded', data }, target);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load spell';
      this._postMessage({ type: 'editSpellError', message }, target);
    }
  }

  private async _handleCopyConfig(
    data: { spellName?: string; target?: string },
    _target?: vscode.Webview
  ): Promise<void> {
    const spellName = data?.spellName?.trim();
    if (!spellName) {
      vscode.window.showWarningMessage('Enter a tool name to copy MCP config.');
      return;
    }
    const target = data?.target || 'kiro';
    const snippet = this._buildConfigSnippet(spellName, target);
    await vscode.env.clipboard.writeText(snippet.text);
    vscode.window.showInformationMessage(`Copied config for ${snippet.label} to clipboard.`);
  }

  private _handleLoadExample(exampleName: string, target?: vscode.Webview) {
    const example = examples[exampleName];
    if (example) {
      const parameters: Array<{ name: string; type: string; required: boolean }> = [];
      const tool = example.tools[0];
      if (tool.inputSchema?.properties) {
        const required = (tool.inputSchema.required as string[]) || [];
        for (const [name, schema] of Object.entries(tool.inputSchema.properties)) {
          parameters.push({ name, type: (schema as { type?: string }).type || 'string', required: required.includes(name) });
        }
      }
      this._postMessage({
        type: 'exampleLoaded',
        data: {
          name: example.name,
          description: example.description,
          actionType: tool.action.type,
          url: tool.action.type === 'http' ? tool.action.config.url : '',
          method: tool.action.type === 'http' ? tool.action.config.method : 'GET',
          code: tool.action.type === 'script' ? tool.action.config.code : '',
          parameters
        }
      }, target);
    }
  }

  private async _loadSpellForEdit(spellPath: string): Promise<EditSpellData> {
    const packageJsonPath = path.join(spellPath, 'package.json');
    const indexJsPath = path.join(spellPath, 'index.js');

    if (!fs.existsSync(indexJsPath)) {
      throw new Error('Missing index.js in spell folder.');
    }

    const indexContent = await fs.promises.readFile(indexJsPath, 'utf8');
    const packageJson = fs.existsSync(packageJsonPath)
      ? JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'))
      : {};

    const transport: 'stdio' | 'sse' = indexContent.includes('SSEServerTransport') ? 'sse' : 'stdio';
    const toolMeta = this._extractToolMetadata(indexContent);
    const tools = this._extractHttpToolsFromCases(indexContent, toolMeta);

    if (tools.length === 0) {
      throw new Error('No HTTP tools could be detected for editing.');
    }

    const authInfo = await this._extractAuthInfo(indexContent, packageJsonPath);
    const authType = authInfo.authType === 'api-key' ? 'apiKey' : authInfo.authType;

    return {
      spellPath,
      name: packageJson.name || path.basename(spellPath),
      description: packageJson.description || '',
      transport,
      authType: authType || '',
      authEnvVar: authInfo.authEnvVar,
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        actionType: 'http',
        method: tool.method,
        url: tool.url,
        parameters: extractUrlParameters(tool.url).map(name => ({
          name,
          type: 'string',
          required: true
        }))
      }))
    };
  }

  private _extractToolMetadata(content: string): Map<string, { description: string }> {
    const meta = new Map<string, { description: string }>();
    const toolMetaPattern = /name:\s*'([^']+)'\s*,\s*description:\s*'([^']*)'/g;
    let match: RegExpExecArray | null;
    while ((match = toolMetaPattern.exec(content)) !== null) {
      meta.set(match[1], { description: match[2] });
    }
    return meta;
  }

  private _extractHttpToolsFromCases(
    content: string,
    meta: Map<string, { description: string }>
  ): Array<{ name: string; description?: string; url: string; method: string }> {
    const tools: Array<{ name: string; description?: string; url: string; method: string }> = [];
    const casePattern = /case\s+'([^']+)':([\s\S]*?)(?=\n\s*case\s+'|\n\s*default:)/g;
    let match: RegExpExecArray | null;

    while ((match = casePattern.exec(content)) !== null) {
      const name = match[1];
      const block = match[2];
      const urlMatch = /const\s+targetUrl\s*=\s*(?:interpolate\('([^']+)'|\'([^']+)\')/m.exec(block);
      const methodMatch = /method:\s*'([A-Z]+)'/m.exec(block);
      const url = this._normalizeUrl((urlMatch && (urlMatch[1] || urlMatch[2])) || '');
      const method = (methodMatch?.[1] || 'GET').toUpperCase();
      if (!url) continue;
      tools.push({
        name,
        description: meta.get(name)?.description,
        url,
        method
      });
    }

    return tools;
  }

  private async _autoRegisterToMcp(
    spellName: string,
    workspaceRoot: vscode.Uri,
    target: string | undefined
  ): Promise<{ ok: boolean; path: string; error?: string }> {
    const targetKey = target || 'kiro';
    try {
      const resolved = this._resolveTargetPath(targetKey, workspaceRoot);
      if (!resolved.path || resolved.mode === 'copy') {
        return { ok: false, path: resolved.path || targetKey, error: 'Auto-register not supported for this target' };
      }

      if (resolved.mode === 'continue') {
        const filePath = path.join(resolved.path, `${spellName}.json`);
        const payload = {
          name: spellName,
          command: 'docker',
          args: ['run', '--rm', '-i', spellName]
        };
        await fs.promises.mkdir(resolved.path, { recursive: true });
        await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
        return { ok: true, path: filePath };
      }

      if (resolved.mode === 'vscode-settings') {
        let settings: any = {};
        try {
          const raw = await fs.promises.readFile(resolved.path, 'utf8');
          settings = JSON.parse(raw);
        } catch {
          settings = {};
        }
        if (!settings['amp.mcpServers']) settings['amp.mcpServers'] = {};
        settings['amp.mcpServers'][spellName] = {
          command: 'docker',
          args: ['run', '--rm', '-i', spellName]
        };
        await fs.promises.mkdir(path.dirname(resolved.path), { recursive: true });
        await fs.promises.writeFile(resolved.path, JSON.stringify(settings, null, 2), 'utf8');
        return { ok: true, path: resolved.path };
      }

      let mcpConfig: any = { mcpServers: {} };
      try {
        const existing = await fs.promises.readFile(resolved.path, 'utf8');
        mcpConfig = JSON.parse(existing);
      } catch {
        // ignore - create new
      }

      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
      mcpConfig.mcpServers[spellName] = {
        command: 'docker',
        args: ['run', '--rm', '-i', spellName]
      };

      await fs.promises.mkdir(path.dirname(resolved.path), { recursive: true });
      await fs.promises.writeFile(resolved.path, JSON.stringify(mcpConfig, null, 2), 'utf8');
      return { ok: true, path: resolved.path };
    } catch (err) {
      return { ok: false, path: targetKey, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private _resolveTargetPath(
    target: string,
    workspaceRoot: vscode.Uri
  ): { path?: string; mode?: 'mcp-json' | 'vscode-settings' | 'continue' | 'copy' } {
    const home = os.homedir();
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');

    switch (target) {
      case 'kiro':
        return { path: path.join(workspaceRoot.fsPath, '.kiro', 'settings', 'mcp.json'), mode: 'mcp-json' };
      case 'vscode-workspace':
        return { path: path.join(workspaceRoot.fsPath, '.vscode', 'mcp.json'), mode: 'mcp-json' };
      case 'vscode-user':
        return { path: path.join(appData, 'Code', 'User', 'mcp.json'), mode: 'mcp-json' };
      case 'cursor':
        return { path: path.join(home, '.cursor', 'mcp.json'), mode: 'mcp-json' };
      case 'claude-desktop':
        return { path: path.join(appData, 'Claude', 'claude_desktop_config.json'), mode: 'mcp-json' };
      case 'claude-code':
        return { path: path.join(workspaceRoot.fsPath, '.mcp.json'), mode: 'mcp-json' };
      case 'continue':
        return { path: path.join(workspaceRoot.fsPath, '.continue', 'mcpServers'), mode: 'continue' };
      case 'cody':
        return { path: path.join(appData, 'Code', 'User', 'settings.json'), mode: 'vscode-settings' };
      default:
        return { mode: 'copy' };
    }
  }

  private _buildConfigSnippet(spellName: string, target: string): { label: string; text: string } {
    const base = {
      mcpServers: {
        [spellName]: {
          command: 'docker',
          args: ['run', '--rm', '-i', spellName]
        }
      }
    };

    if (target === 'cody') {
      return {
        label: 'Cody (settings.json)',
        text: JSON.stringify({ 'amp.mcpServers': base.mcpServers }, null, 2)
      };
    }

    if (target === 'continue') {
      return {
        label: 'Continue (.continue/mcpServers)',
        text: JSON.stringify({
          name: spellName,
          command: 'docker',
          args: ['run', '--rm', '-i', spellName]
        }, null, 2)
      };
    }

    const labelMap: Record<string, string> = {
      kiro: 'Kiro',
      'vscode-workspace': 'VS Code (workspace)',
      'vscode-user': 'VS Code (user)',
      cursor: 'Cursor',
      'claude-desktop': 'Claude Desktop',
      'claude-code': 'Claude Code',
      windsurf: 'Windsurf',
      jetbrains: 'JetBrains',
      zed: 'Zed',
      cline: 'Cline/Roo'
    };

    return {
      label: labelMap[target] || 'MCP',
      text: JSON.stringify(base, null, 2)
    };
  }

  /**
   * Handles API testing - calls the endpoint and infers schema from response.
   * This is the core differentiator: AI guesses, Spellbook verifies.
   */
  private async _handleTestApi(data: {
    toolId: number;
    url: string;
    method: string;
    headers?: Record<string, string>;
    authType?: string;
    authEnvVar?: string;
    testValues?: Record<string, string>;
  }, target?: vscode.Webview) {
    const { toolId, url, method, headers, authType, authEnvVar, testValues } = data;

    try {
      log(`🧪 Testing API: ${method} ${url}`);

      // Replace {{placeholders}} with actual test values provided by user
      const testUrl = url.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return testValues?.[key] || `test_${key}`;
      });

      // Security: Validate URL (SSRF protection)
      await this._assertSafeUrl(testUrl);

      // Build auth headers if configured
      const authHeaders: Record<string, string> = {};
      if (authType && authEnvVar) {
        const authValue = process.env[authEnvVar];
        if (authValue) {
          if (authType === 'bearer') {
            authHeaders['Authorization'] = `Bearer ${authValue}`;
          } else if (authType === 'apiKey' || authType === 'api-key') {
            authHeaders['X-API-Key'] = authValue;
          }
          log(`🔐 Using ${authType} auth from ${authEnvVar}`);
        } else {
          log(`⚠️ Auth configured but ${authEnvVar} not set in environment`);
        }
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(testUrl, {
        method,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Spellbook-API-Tester/1.0',
          ...authHeaders,
          ...headers
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') || '';
      let body: unknown;
      let inferredSchema: JSONSchema | null = null;

      if (contentType.includes('application/json')) {
        const text = await this._readBodyWithLimit(response, 5 * 1024 * 1024);
        body = JSON.parse(text);
        inferredSchema = inferSchema(body);
      } else {
        body = await this._readBodyWithLimit(response, 5 * 1024 * 1024);
      }

      // Extract URL parameters for input schema
      const urlParams = extractUrlParameters(url);

      log(`✓ API test successful: ${response.status}`);

      this._postMessage({
        type: 'testApiResult',
        toolId,
        success: true,
        statusCode: response.status,
        statusText: response.statusText,
        contentType,
        response: typeof body === 'object' ? body : { text: body },
        inferredSchema,
        urlParameters: urlParams
      }, target);

    } catch (err) {
      const errorMessage = err instanceof Error
        ? (err.name === 'AbortError' ? 'Request timeout (10s)' : err.message)
        : 'Request failed';

      error('API test failed', err instanceof Error ? err : undefined);

      this._postMessage({
        type: 'testApiResult',
        toolId,
        success: false,
        error: errorMessage
      }, target);
    }
  }

  /**
   * Handles OpenAPI spec import - fetches, parses, and generates tools.
   */
  private async _handleImportOpenAPI(data: { url: string }, target?: vscode.Webview) {
    const { url } = data;

    try {
      await this._assertSafeUrl(url);
      log(`📜 Fetching OpenAPI spec from: ${url}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json, application/yaml',
          'User-Agent': 'Spellbook-OpenAPI-Importer/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let specText: string;

      const rawText = await this._readBodyWithLimit(response, 5 * 1024 * 1024);
      if (contentType.includes('application/json') || url.endsWith('.json')) {
        const json = JSON.parse(rawText);
        specText = JSON.stringify(json);
      } else {
        specText = rawText;
      }

      // Parse the OpenAPI spec
      const parsed = parseOpenApiSpec(specText);

      log(`✓ Parsed OpenAPI spec: ${parsed.apiName} (${parsed.tools.length} endpoints)`);

      // Generate tool data for UI
      const toolsData = parsed.tools.map((endpoint: any) => ({
        name: endpoint.operationId || endpoint.name,
        description: endpoint.description || endpoint.summary || `${endpoint.method} ${endpoint.path}`,
        actionType: 'http' as const,
        method: endpoint.method.toUpperCase(),
        url: endpoint.url,
        parameters: [],
        execution: 'unsafe'
      }));

      this._postMessage({
        type: 'openapiImportResult',
        success: true,
        apiName: parsed.apiName,
        suggestedName: parsed.suggestedName,
        tools: toolsData
      }, target);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import OpenAPI spec';
      error('OpenAPI import failed', err instanceof Error ? err : undefined);

      this._postMessage({
        type: 'openapiImportResult',
        success: false,
        error: errorMessage
      }, target);
    }
  }

  /**
   * Handles Magic auto-generate - URL → Complete Spell.
   * The S-grade feature: zero config, paste URL, get working spell.
   */
  private async _handleMagic(data: { url: string; method?: string; testValues?: Record<string, string> }, target?: vscode.Webview) {
    const { url, method = 'GET', testValues = {} } = data;

    try {
      log(`✨ Magic auto-generate: ${method} ${url}`);

      // Build auth header if configured
      let authHeader: string | undefined;
      // Note: In webview we'd need to pass auth config too, but for now skip

      const result = await magicFromUrl(url, {
        method,
        testValues,
        authHeader,
        timeout: 10000
      });

      if (result.success && result.spell) {
        log(`✓ Magic generated spell: ${result.spell.name}`);

        this._postMessage({
          type: 'magicResult',
          success: true,
          spell: result.spell,
          warnings: result.warnings
        }, target);
      } else {
        this._postMessage({
          type: 'magicResult',
          success: false,
          error: result.error || 'Failed to generate spell'
        }, target);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Magic failed';
      error('Magic auto-generate failed', err instanceof Error ? err : undefined);

      this._postMessage({
        type: 'magicResult',
        success: false,
        error: errorMessage
      }, target);
    }
  }

  private async _handleBulkTest(
    data: { tools: BulkTestTool[]; options?: BulkTestOptions },
    target?: vscode.Webview
  ) {
    try {
      if (!data.tools || data.tools.length === 0) {
        this._postMessage({ type: 'bulkTestResult', success: false, error: 'No HTTP tools to test.' }, target);
        return;
      }

      const options = data.options || {};
      const authType = options.authType === 'apiKey' || options.authType === 'bearer' ? options.authType : undefined;
      const report = await bulkTestTools(data.tools, {
        concurrency: options.concurrency,
        timeoutMs: options.timeoutMs,
        rps: options.rps,
        retries: options.retries,
        authType,
        authEnvVar: options.authEnvVar
      });

      let reportPath: string | undefined;
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, 'spellbook-report.json');
        const payload = Buffer.from(JSON.stringify(report, null, 2), 'utf8');
        await vscode.workspace.fs.writeFile(fileUri, payload);
        reportPath = fileUri.fsPath;
      }

      this._postMessage({ type: 'bulkTestResult', success: true, report, reportPath }, target);
    } catch (err) {
      this._postMessage({
        type: 'bulkTestResult',
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }, target);
    }
  }

  private async _sendSpellsList(target?: vscode.Webview) {
    const spells = await this._getSpells();
    this._postMessage({ type: 'spellsList', spells }, target);
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
    const tools = data.tools.map((t: any) => {
      const inputSchema: any = { type: 'object', properties: {}, required: [] };
      const parameters = Array.isArray(t.parameters) ? [...t.parameters] : [];

      if (t.actionType === 'http' && parameters.length === 0 && t.url) {
        const urlParams = extractUrlParameters(t.url);
        for (const param of urlParams) {
          parameters.push({ name: param, type: 'string', required: true });
        }
      }

      if (parameters.length > 0) {
        for (const param of parameters) {
          if (param.name) {
            inputSchema.properties[param.name] = { type: param.type || 'string' };
            if (param.required) inputSchema.required.push(param.name);
          }
        }
      }
      if (inputSchema.required.length === 0) delete inputSchema.required;

      const action = t.actionType === 'http'
        ? { type: 'http' as const, config: { url: t.url, method: t.method || 'GET', ...(t.headers && Object.keys(t.headers).length > 0 && { headers: t.headers }), ...(t.body && { body: t.body }) } }
        : { type: 'script' as const, config: { runtime: 'node' as const, code: t.code, execution: t.execution || 'isolated' } };

      return {
        name: t.name,
        description: t.description,
        inputSchema,
        outputSchema: t.outputSchema || { type: 'object', properties: {} },
        action
      };
    });

    const spell: any = {
      id: randomUUID(),
      name: data.name,
      description: data.description,
      transport: data.transport || 'stdio',
      tools
    };

    if (data.authType) {
      if (data.authType === 'oauth2') {
        spell.auth = {
          type: 'oauth2',
          config: {
            clientId: data.oauthConfig.clientId,
            clientSecret: data.oauthConfig.clientSecret,
            authUrl: data.oauthConfig.authUrl,
            tokenUrl: data.oauthConfig.tokenUrl,
            scopes: data.oauthConfig.scopes || [],
            tokenEnvVar: data.authEnvVar || 'MCP_ACCESS_TOKEN'
          }
        };
      } else {
        const normalizedAuthType = data.authType === 'apiKey' ? 'api-key' : data.authType;
        spell.auth = {
          type: normalizedAuthType,
          envVar: data.authEnvVar,
          ...(data.authHeader && { headerKey: data.authHeader })
        };
      }
    }

    return spell;
  }

  private _getHtmlForWebview(): string {
    try {
      const htmlPath = path.join(this._extensionUri.fsPath, 'resources', 'sidebar.html');
      let html = fs.readFileSync(htmlPath, 'utf-8');

      // Security: Content Security Policy
      // Generate a nonce for scripts
      const nonce = randomUUID().replace(/-/g, '');

      // Define CSP policy
      // script-src: Allows only scripts with the nonce
      // style-src: unsafe-inline is required for style="..." attributes currently used extensively
      // img-src: Allows data: for base64 images and https: for external images
      const csp = [
        `default-src 'none'`,
        `script-src 'nonce-${nonce}'`,
        // Strict CSP: No unsafe-inline allowed for scripts or attributes
        `style-src 'unsafe-inline'`,
        `font-src 'self' data: https:`,
        `img-src 'self' data: https:`
      ].join('; ');

      // Inject CSP and Nonce
      html = html.replace('<!-- CSP_META -->', `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
      html = html.replace(/<!-- NONCE -->/g, nonce);

      return html;
    } catch (e) {
      error('Failed to load sidebar HTML', e instanceof Error ? e : new Error(String(e)));
      return `<!DOCTYPE html><html><body><h1>Error loading sidebar</h1><p>${e}</p></body></html>`;
    }
  }

  // ============================================================================
  // Watch Mode Handlers
  // ============================================================================

  /**
   * Handles changes detected by the WatchManager.
   * Shows VS Code notification and updates the webview.
   */
  private _handleWatchChanges(changes: SchemaChange[]): void {
    if (changes.length === 0) return;

    const spellName = changes[0].spellId;
    const watchState = this._watchedSpells.get(spellName);

    if (watchState) {
      watchState.changes = [...watchState.changes, ...changes];
    }

    // Show VS Code notification
    const changeCount = changes.length;
    const changeSummary = changes.map(c => `${c.type}: ${c.path}`).join(', ');

    vscode.window.showWarningMessage(
      `🔔 API changed for "${spellName}": ${changeCount} change(s) detected`,
      'View Changes'
    ).then(selection => {
      if (selection === 'View Changes') {
        // Switch to grimoire tab
        this.switchToSpellsTab();
      }
    });

    // Update webview
    this._postMessage({
      type: 'watchChangesDetected',
      spellName,
      changes
    });

    log(`👁️ Watch Mode detected ${changeCount} changes for ${spellName}: ${changeSummary}`);
  }

  /**
   * Starts watching a spell for API changes.
   * Parses index.js to extract tool URLs and sets up real polling.
   */
  private async _handleStartWatch(spellName: string, spellPath: string): Promise<void> {
    try {
      const indexJsPath = path.join(spellPath, 'index.js');
      const packageJsonPath = path.join(spellPath, 'package.json');

      if (!fs.existsSync(indexJsPath)) {
        vscode.window.showErrorMessage(`Cannot watch ${spellName}: missing index.js`);
        return;
      }

      // Parse index.js to extract tool definitions
      const indexContent = await fs.promises.readFile(indexJsPath, 'utf8');
      const tools = this._extractToolsFromIndex(indexContent, spellName);

      if (tools.length === 0) {
        vscode.window.showWarningMessage(`No HTTP tools found in ${spellName}`);
        return;
      }

      // Try to extract auth info from spell config
      // Store only env var names in WatchState (NOT resolved tokens) for security
      const authInfo = await this._extractAuthInfo(indexContent, packageJsonPath);

      const watchState: WatchState = {
        watching: true,
        changes: [],
        authEnvVar: authInfo.authEnvVar,
        authType: authInfo.authType
      };

      // Default to 5 minutes - less aggressive than 60s
      const intervalMs = 5 * 60 * 1000;

      // Start watching each tool
      for (const tool of tools) {
        const config: WatchConfig = {
          spellId: spellName,
          toolName: tool.name,
          testUrl: tool.url,
          method: tool.method || 'GET',
          testValues: tool.testValues || {},
          intervalMs,
          lastSchema: null,  // Will be set on first check
          lastChecked: new Date(),
          authHeader: authInfo.authHeader  // Resolved at runtime, NOT persisted
        };

        // Store the config
        watchState.config = config;

        // ACTUALLY START WATCHING
        this._watchManager.startWatching(config);

        log(`👁️ Started watching tool: ${tool.name} at ${tool.url}${authInfo.authHeader ? ' (with auth)' : ''}`);
      }

      this._watchedSpells.set(spellName, watchState);

      // Persist to storage so watches survive VS Code restarts
      this._persistWatches();

      // Notify webview
      this._postMessage({
        type: 'watchStarted',
        spellName
      });

      // Show confirmation with tool count
      const minutes = intervalMs / 60000;
      vscode.window.showInformationMessage(
        `👁️ Now watching "${spellName}": ${tools.length} tool(s), checking every ${minutes}min${authInfo.authHeader ? ' (auth included)' : ''}`
      );

    } catch (err) {
      error(`Failed to start watching ${spellName}`, err instanceof Error ? err : undefined);
      vscode.window.showErrorMessage(`Failed to watch ${spellName}: ${err}`);
    }
  }

  /**
   * Extracts auth info from spell config.
   * Returns both the resolved header (for runtime) and env var info (for persistence).
   * Only the env var info should be persisted, never the resolved token.
   */
  private async _extractAuthInfo(indexContent: string, packageJsonPath: string): Promise<{
    authHeader?: string;      // Resolved at runtime - NOT persisted
    authEnvVar?: string;      // Env var name - safe to persist
    authType?: 'bearer' | 'api-key';  // Auth type - safe to persist
  }> {
    try {
      // Pattern 1: Look for Authorization header in index.js
      // Example: 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
      const authPattern = /['"]Authorization['"]:\s*[`'"]([^`'"]+)[`'"]/;
      const authMatch = authPattern.exec(indexContent);

      if (authMatch) {
        // Found hardcoded auth pattern, try to resolve env var
        const envVarPattern = /\$\{process\.env\.(\w+)\}/;
        const envMatch = envVarPattern.exec(authMatch[1]);

        if (envMatch) {
          const envVarName = envMatch[1];
          const envValue = process.env[envVarName];
          const isBearerPattern = authMatch[1].toLowerCase().startsWith('bearer');

          if (envValue) {
            return {
              authHeader: authMatch[1].replace(envVarPattern, envValue),
              authEnvVar: envVarName,
              authType: isBearerPattern ? 'bearer' : 'api-key'
            };
          }
          // Return env var info even if not resolved (for persistence)
          return {
            authEnvVar: envVarName,
            authType: isBearerPattern ? 'bearer' : 'api-key'
          };
        }
      }

      // Pattern 2: Check package.json for auth config
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));

        if (packageJson.spellbook?.auth) {
          const auth = packageJson.spellbook.auth;

          if (auth.type === 'bearer' && auth.envVar) {
            const token = process.env[auth.envVar];
            return {
              authHeader: token ? `Bearer ${token}` : undefined,
              authEnvVar: auth.envVar,
              authType: 'bearer'
            };
          } else if (auth.type === 'api-key' && auth.envVar) {
            const key = process.env[auth.envVar];
            return {
              authHeader: key,
              authEnvVar: auth.envVar,
              authType: 'api-key'
            };
          }
        }
      }

      return {};
    } catch {
      return {};
    }
  }

  /**
   * Resolves auth header from stored env var info.
   * Called at runtime, not at persist time.
   */
  private _resolveAuthHeader(authEnvVar?: string, authType?: 'bearer' | 'api-key'): string | undefined {
    if (!authEnvVar) return undefined;

    const value = process.env[authEnvVar];
    if (!value) return undefined;

    return authType === 'bearer' ? `Bearer ${value}` : value;
  }

  private async _assertSafeUrl(rawUrl: string): Promise<void> {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Protocol not allowed: ${parsed.protocol}`);
    }

    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
      throw new Error('Localhost is not allowed');
    }

    const ipType = isIP(host);
    if (ipType && this._isPrivateIp(host)) {
      throw new Error('Private or loopback IPs are not allowed');
    }

    if (!ipType) {
      const results = await lookup(host, { all: true });
      for (const result of results) {
        if (this._isPrivateIp(result.address)) {
          throw new Error('Private or loopback IPs are not allowed');
        }
      }
    }
  }

  private _isPrivateIp(address: string): boolean {
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

  private async _readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      throw new Error(`Response too large: ${contentLength} bytes (max ${maxBytes} bytes)`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      if (text.length > maxBytes) {
        throw new Error(`Response too large: ${text.length} bytes (max ${maxBytes} bytes)`);
      }
      return text;
    }

    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel();
        throw new Error(`Response too large: exceeded ${maxBytes} bytes`);
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }

    return chunks.join('');
  }

  /**
   * Extracts tool definitions from index.js content.
   * Looks for fetch() calls or URL patterns in the generated MCP server.
   */
  private _extractToolsFromIndex(content: string, spellName: string): Array<{
    name: string;
    url: string;
    method: string;
    testValues: Record<string, string>;
  }> {
    const tools: Array<{
      name: string;
      url: string;
      method: string;
      testValues: Record<string, string>;
    }> = [];

    // Pattern 1: Look for fetch() calls with template literals or string URLs
    // Example: fetch(`https://api.github.com/users/${username}`)
    const fetchPattern = /fetch\(\s*[`'"]([^`'"]+)[`'"]\s*(?:,\s*\{[^}]*method:\s*['"](\w+)['"][^}]*\})?\)/g;

    // Pattern 2: Look for URL variable assignments
    // Example: const url = `https://api.github.com/repos/${owner}/${repo}`;
    const urlAssignPattern = /(?:const|let|var)\s+(?:url|apiUrl|endpoint)\s*=\s*[`'"]([^`'"]+)[`'"]/g;

    // Pattern 3: Look for tool name definitions
    // Example: name: 'get-user'
    const toolNamePattern = /name:\s*['"]([^'"]+)['"]/g;

    let match;
    const foundUrls: string[] = [];
    const foundNames: string[] = [];

    // Extract URLs from fetch calls
    while ((match = fetchPattern.exec(content)) !== null) {
      const url = match[1];
      const method = match[2] || 'GET';
      if (url.startsWith('http')) {
        foundUrls.push(url);
        // Try to find the associated method
        const tool = {
          name: `tool-${foundUrls.length}`,
          url: this._normalizeUrl(url),
          method: method.toUpperCase(),
          testValues: this._generateTestValues(url)
        };
        tools.push(tool);
      }
    }

    // If no fetch found, try URL assignments
    if (tools.length === 0) {
      while ((match = urlAssignPattern.exec(content)) !== null) {
        const url = match[1];
        if (url.startsWith('http')) {
          foundUrls.push(url);
          tools.push({
            name: `tool-${foundUrls.length}`,
            url: this._normalizeUrl(url),
            method: 'GET',
            testValues: this._generateTestValues(url)
          });
        }
      }
    }

    // Extract tool names for better naming
    while ((match = toolNamePattern.exec(content)) !== null) {
      foundNames.push(match[1]);
    }

    // Apply found names to tools
    for (let i = 0; i < Math.min(tools.length, foundNames.length); i++) {
      tools[i].name = foundNames[i];
    }

    return tools;
  }

  /**
   * Normalizes URL by replacing template literal expressions with placeholders.
   */
  private _normalizeUrl(url: string): string {
    // Replace ${varName} with {{varName}}
    return url.replace(/\$\{(\w+)\}/g, '{{$1}}');
  }

  /**
   * Generates sensible test values for URL parameters.
   */
  private _generateTestValues(url: string): Record<string, string> {
    const testValues: Record<string, string> = {};

    // Extract ${param} or {{param}} patterns
    const paramPattern = /(?:\$\{|{{)(\w+)(?:}|})/g;
    let match;

    while ((match = paramPattern.exec(url)) !== null) {
      const param = match[1].toLowerCase();

      // Smart defaults based on common parameter names
      if (param.includes('user') || param.includes('owner')) {
        testValues[match[1]] = 'octocat';
      } else if (param.includes('repo')) {
        testValues[match[1]] = 'Hello-World';
      } else if (param.includes('id')) {
        testValues[match[1]] = '1';
      } else if (param.includes('name')) {
        testValues[match[1]] = 'test';
      } else {
        testValues[match[1]] = 'test';
      }
    }

    return testValues;
  }

  /**
   * Stops watching a spell.
   */
  private _handleStopWatch(spellName: string): void {
    const watchState = this._watchedSpells.get(spellName);

    if (watchState && watchState.config) {
      this._watchManager.stopWatching(spellName, watchState.config.toolName);
    }

    this._watchedSpells.delete(spellName);

    // Persist to storage
    this._persistWatches();

    log(`👁️ Stopped watching: ${spellName}`);

    // Notify webview
    this._postMessage({
      type: 'watchStopped',
      spellName
    });
  }

  /**
   * Acknowledges and clears detected changes for a spell.
   */
  private _handleAcknowledgeChanges(spellName: string): void {
    const watchState = this._watchedSpells.get(spellName);

    if (watchState) {
      watchState.changes = [];
    }

    log(`👁️ Acknowledged changes for: ${spellName}`);
  }

  /**
   * Sends the current watch state to the webview.
   */
  private _sendWatchState(target?: vscode.Webview): void {
    const state: Record<string, WatchState> = {};

    for (const [name, watchState] of this._watchedSpells) {
      state[name] = watchState;
    }

    this._postMessage({
      type: 'watchState',
      state
    }, target);
  }

  // ============================================================================
  // Watch Persistence
  // ============================================================================

  /**
   * Persists watched spells to workspaceState.
   * Called after starting/stopping watches.
   * SECURITY: Only stores env var names, never resolved tokens.
   */
  private _persistWatches(): void {
    try {
      // Store serializable data (can't store Map directly)
      // SECURITY: Strip authHeader from config before persisting
      const data: Array<{
        spellName: string;
        spellPath: string;
        authEnvVar?: string;
        authType?: 'bearer' | 'api-key';
        config?: Omit<WatchConfig, 'authHeader'>;  // Exclude resolved token
      }> = [];

      for (const [spellName, state] of this._watchedSpells) {
        if (state.config) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { authHeader, ...safeConfig } = state.config;
          data.push({
            spellName,
            spellPath: this._getSpellPath(spellName) || '',
            authEnvVar: state.authEnvVar,
            authType: state.authType,
            config: safeConfig  // Config without authHeader
          });
        }
      }

      this._context.workspaceState.update(
        GrimoireSidebarProvider.WATCH_STORAGE_KEY,
        data
      );

      log(`👁️ Persisted ${data.length} watch(es) to storage (tokens not stored)`);
    } catch (err) {
      error('Failed to persist watches', err instanceof Error ? err : undefined);
    }
  }

  /**
   * Restores watched spells from workspaceState.
   * Called on extension startup.
   * SECURITY: Resolves auth from env vars at runtime, not from stored tokens.
   */
  private async _restoreWatches(): Promise<void> {
    try {
      const data = this._context.workspaceState.get<Array<{
        spellName: string;
        spellPath: string;
        authEnvVar?: string;
        authType?: 'bearer' | 'api-key';
        config?: Omit<WatchConfig, 'authHeader'>;
      }>>(GrimoireSidebarProvider.WATCH_STORAGE_KEY);

      if (!data || data.length === 0) {
        return;
      }

      log(`👁️ Restoring ${data.length} watch(es) from storage`);

      for (const item of data) {
        if (item.spellPath) {
          // Re-start the watch - this will re-extract auth from env vars
          await this._handleStartWatch(item.spellName, item.spellPath);
        }
      }

    } catch (err) {
      error('Failed to restore watches', err instanceof Error ? err : undefined);
    }
  }

  /**
   * Gets the spell path by name from the current workspace.
   * Checks workspace root first (where spells are created), then spells/ subdirectory.
   */
  private _getSpellPath(spellName: string): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;

    // Try direct path first (where spells are actually created)
    const directPath = path.join(workspaceFolder.uri.fsPath, spellName);
    if (fs.existsSync(directPath)) {
      return directPath;
    }

    // Fallback to spells/ subdirectory
    const spellsPath = path.join(workspaceFolder.uri.fsPath, 'spells', spellName);
    if (fs.existsSync(spellsPath)) {
      return spellsPath;
    }

    return undefined;
  }
}

