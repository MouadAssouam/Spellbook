// kiro-generated
/**
 * Grimoire Panel - Visual Spell Builder
 *
 * Hosts the same grimoire webview used in the sidebar, to avoid UI divergence.
 */

import * as vscode from 'vscode';
import { GrimoireSidebarProvider } from '../providers/GrimoireSidebarProvider';
import { log } from '../utils/logger';

export class GrimoirePanel {
  public static currentPanel: GrimoirePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _sidebarProvider: GrimoireSidebarProvider;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, sidebarProvider: GrimoireSidebarProvider) {
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
      ' Spellbook Grimoire',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    GrimoirePanel.currentPanel = new GrimoirePanel(panel, sidebarProvider);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    sidebarProvider: GrimoireSidebarProvider
  ) {
    this._panel = panel;
    this._sidebarProvider = sidebarProvider;

    // Attach the sidebar controller to this panel webview
    const messageDisposable = this._sidebarProvider.attachPanelWebview(this._panel.webview);
    this._disposables.push(messageDisposable);

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    log(' Grimoire panel opened');
  }

  public dispose() {
    GrimoirePanel.currentPanel = undefined;
    this._sidebarProvider.detachPanelWebview(this._panel.webview);
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
    log(' Grimoire panel closed');
  }
}
