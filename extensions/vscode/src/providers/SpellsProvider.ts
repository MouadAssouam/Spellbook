/**
 * Spells Tree Data Provider
 * 
 * Displays all MCP spells in the workspace sidebar
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class SpellsProvider implements vscode.TreeDataProvider<SpellItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SpellItem | undefined | null | void> = new vscode.EventEmitter<SpellItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SpellItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private workspaceRoot: string | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SpellItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SpellItem): Promise<SpellItem[]> {
    if (!this.workspaceRoot) {
      return [];
    }

    if (element) {
      // Show spell files
      return this.getSpellFiles(element.resourceUri!.fsPath);
    } else {
      // Show all spells (directories with package.json)
      return this.getSpells(this.workspaceRoot);
    }
  }

  private async getSpells(workspaceRoot: string): Promise<SpellItem[]> {
    const spells: SpellItem[] = [];

    try {
      const entries = await fs.promises.readdir(workspaceRoot, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const spellPath = path.join(workspaceRoot, entry.name);
          const packageJsonPath = path.join(spellPath, 'package.json');

          // Check if it's a spell (has package.json with MCP server)
          if (fs.existsSync(packageJsonPath)) {
            try {
              const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
              
              // Check if it's an MCP server
              if (packageJson.name && packageJson.description) {
                spells.push(new SpellItem(
                  entry.name,
                  packageJson.description || 'MCP Tool',
                  vscode.Uri.file(spellPath),
                  vscode.TreeItemCollapsibleState.Collapsed
                ));
              }
            } catch (err) {
              // Skip invalid package.json
            }
          }
        }
      }
    } catch (err) {
      // Workspace not accessible
    }

    // Return empty array to show welcome view when no spells
    return spells;
  }

  private async getSpellFiles(spellPath: string): Promise<SpellItem[]> {
    const files: SpellItem[] = [];
    const importantFiles = ['index.js', 'package.json', 'Dockerfile', 'README.md'];

    for (const filename of importantFiles) {
      const filePath = path.join(spellPath, filename);
      if (fs.existsSync(filePath)) {
        files.push(new SpellItem(
          filename,
          '',
          vscode.Uri.file(filePath),
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(filePath)]
          }
        ));
      }
    }

    return files;
  }
}

class SpellItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly resourceUri: vscode.Uri | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = description || label;
    this.description = description;

    // Set icon based on type
    if (resourceUri) {
      if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
        // File
        this.iconPath = vscode.ThemeIcon.File;
      } else {
        // Spell directory
        this.iconPath = new vscode.ThemeIcon('symbol-misc', new vscode.ThemeColor('charts.yellow'));
      }
    }
  }
}
