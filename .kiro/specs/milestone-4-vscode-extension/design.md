# Design Document - Milestone 4: VS Code Extension

## Overview

The VS Code extension provides a simple command-based interface for generating MCP servers. It uses VS Code's built-in input prompts to collect spell details, generates files using our core generator, and saves them directly to the workspace.

## Architecture

### Component Structure

```
extensions/vscode/
├── src/
│   ├── extension.ts       (main entry point)
│   ├── commands/
│   │   └── create-spell.ts (command implementation)
│   └── utils/
│       └── prompts.ts     (input collection)
├── package.json           (extension manifest)
└── tsconfig.json
```

### Data Flow

```
User invokes command
    ↓
Collect spell details via prompts
    ↓
Validate inputs
    ↓
Generate files using @spellbook/core
    ↓
Write files to workspace
    ↓
Show success notification + open README
```

## Components and Interfaces

### extension.ts

**Responsibilities:**
- Register commands
- Handle activation
- Provide extension context

**Interface:**
```typescript
export function activate(context: vscode.ExtensionContext): void;
export function deactivate(): void;
```

### commands/create-spell.ts

**Responsibilities:**
- Collect user input
- Validate spell definition
- Generate files
- Write to workspace
- Handle errors

**Interface:**
```typescript
export async function createSpellCommand(): Promise<void>;
```

### utils/prompts.ts

**Responsibilities:**
- Show input prompts
- Validate user input
- Build spell object

**Interface:**
```typescript
export async function collectSpellDetails(): Promise<Spell | undefined>;
```

## Data Models

### Spell Collection Flow

1. **Name**: Input box with validation (3-50 chars, kebab-case)
2. **Description**: Input box with validation (100-500 chars)
3. **Action Type**: Quick pick (HTTP or Script)
4. **If HTTP**:
   - URL: Input box with URL validation
   - Method: Quick pick (GET, POST, PUT, PATCH, DELETE)
5. **If Script**:
   - Code: Input box (JavaScript code)
6. **Input Schema**: Use default `{ type: 'object', properties: {} }`
7. **Output Schema**: Use default `{ type: 'object', properties: {} }`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Command registration

*For any* VS Code instance with the extension installed, the "Spellbook: Create MCP Server" command should be available in the command palette

**Validates: Requirements 1.1, 1.3**

### Property 2: File generation completeness

*For any* valid spell input, the extension should create exactly 4 files in a new directory

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: Error handling

*For any* invalid input or error condition, the extension should show a user-friendly error message and not create partial files

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 4: Workspace requirement

*For any* command invocation without an open workspace, the extension should show an error and not attempt file creation

**Validates: Requirements 4.2**

## Error Handling

### Input Validation Errors

```typescript
if (!isValidSpellName(name)) {
  vscode.window.showErrorMessage('Spell name must be 3-50 characters (letters, numbers, hyphens only)');
  return;
}
```

### File System Errors

```typescript
try {
  await vscode.workspace.fs.writeFile(uri, content);
} catch (error) {
  vscode.window.showErrorMessage(`Failed to write file: ${error.message}`);
  // Clean up partial files
}
```

### No Workspace Error

```typescript
if (!vscode.workspace.workspaceFolders) {
  vscode.window.showErrorMessage('Please open a folder first');
  return;
}
```

## Testing Strategy

### Manual Testing

Since VS Code extensions are difficult to unit test, we'll rely on manual testing:

1. **Command availability**: Open command palette, search for "Spellbook"
2. **Input validation**: Try invalid names, descriptions
3. **File generation**: Complete flow, verify all files created
4. **Error handling**: Test with no workspace, invalid inputs
5. **Success flow**: Verify README opens, notification shows

### Integration Testing

Test the complete flow:
1. Install extension in VS Code
2. Open a test workspace
3. Run "Spellbook: Create MCP Server" command
4. Provide valid inputs
5. Verify files created correctly
6. Verify README opens
7. Test with invalid inputs
8. Verify error messages

## Implementation Details

### Extension Manifest (package.json)

```json
{
  "name": "spellbook",
  "displayName": "Spellbook",
  "description": "Visual MCP tool builder",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onCommand:spellbook.createMCPServer"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "spellbook.createMCPServer",
        "title": "Spellbook: Create MCP Server"
      }
    ]
  },
  "dependencies": {
    "@spellbook/core": "workspace:*"
  },
  "devDependencies": {
    "@types/vscode": "^1.80.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Command Implementation

```typescript
import * as vscode from 'vscode';
import { generateMCPServer, SpellSchema } from '@spellbook/core';
import { v4 as uuidv4 } from 'uuid';

export async function createSpellCommand() {
  // Check workspace
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Please open a folder first');
    return;
  }

  // Collect inputs
  const name = await vscode.window.showInputBox({
    prompt: 'Spell name (kebab-case)',
    placeHolder: 'github-fetcher',
    validateInput: (value) => {
      if (!/^[a-zA-Z0-9-]{3,50}$/.test(value)) {
        return 'Name must be 3-50 characters (letters, numbers, hyphens only)';
      }
      return null;
    }
  });
  if (!name) return;

  const description = await vscode.window.showInputBox({
    prompt: 'Description (100-500 characters)',
    placeHolder: 'Fetches GitHub issues by repository and label...',
    validateInput: (value) => {
      if (value.length < 100 || value.length > 500) {
        return 'Description must be 100-500 characters';
      }
      return null;
    }
  });
  if (!description) return;

  const actionType = await vscode.window.showQuickPick(['HTTP', 'Script'], {
    placeHolder: 'Select action type'
  });
  if (!actionType) return;

  let action;
  if (actionType === 'HTTP') {
    const url = await vscode.window.showInputBox({
      prompt: 'URL',
      placeHolder: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues'
    });
    if (!url) return;

    const method = await vscode.window.showQuickPick(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], {
      placeHolder: 'HTTP method'
    });
    if (!method) return;

    action = { type: 'http' as const, config: { url, method: method as any } };
  } else {
    const code = await vscode.window.showInputBox({
      prompt: 'JavaScript code',
      placeHolder: 'return { result: input.value * 2 };'
    });
    if (!code) return;

    action = { type: 'script' as const, config: { runtime: 'node' as const, code } };
  }

  // Build spell
  const spell = {
    id: uuidv4(),
    name,
    description,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    action
  };

  try {
    // Generate files
    const files = generateMCPServer(spell);

    // Create directory
    const spellDir = vscode.Uri.joinPath(workspaceFolder.uri, name);
    await vscode.workspace.fs.createDirectory(spellDir);

    // Write files
    for (const [filename, content] of Object.entries(files)) {
      const fileUri = vscode.Uri.joinPath(spellDir, filename);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
    }

    // Open README
    const readmeUri = vscode.Uri.joinPath(spellDir, 'README.md');
    await vscode.window.showTextDocument(readmeUri);

    vscode.window.showInformationMessage(`✨ MCP server "${name}" created successfully!`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create MCP server: ${error.message}`);
  }
}
```

## Security Considerations

1. **Input Validation**: All user inputs are validated before use
2. **File System**: Only writes to workspace, no arbitrary paths
3. **Code Execution**: Script actions are not executed by the extension
4. **Dependencies**: Uses trusted @spellbook/core package

## Performance Considerations

- Extension activates only when command is invoked
- File generation is synchronous and fast (< 100ms)
- No background processes or watchers
- Minimal memory footprint
