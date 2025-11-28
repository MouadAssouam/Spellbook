# Design Document

## Overview

Milestone 8 polishes the Spellbook VS Code extension to provide a professional user experience. This includes enhanced progress feedback, detailed error handling, quick actions after spell creation, and an output channel for debugging. The focus is on making the extension feel production-ready.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  EXTENSION POLISH                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Output Channel                                  │   │
│  │  - Detailed logging                              │   │
│  │  - Error stack traces                            │   │
│  │  - Operation timestamps                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Progress Notifications                          │   │
│  │  - Cancellable progress                          │   │
│  │  - Step-by-step updates                          │   │
│  │  - Success/error states                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Quick Actions                                   │   │
│  │  - Open README                                   │   │
│  │  - Open in Terminal                              │   │
│  │  - Copy mcp.json config                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Enhanced Validation                             │   │
│  │  - Field-specific errors                         │   │
│  │  - Helpful examples                              │   │
│  │  - Inline suggestions                            │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Output Channel

```typescript
// Create output channel on activation
const outputChannel = vscode.window.createOutputChannel('Spellbook');

// Log operations
function log(message: string): void {
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] ${message}`);
}
```

### Progress Notifications

```typescript
// Enhanced progress with cancellation
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: '✨ Summoning Spell...',
  cancellable: true
}, async (progress, token) => {
  token.onCancellationRequested(() => {
    // Clean up partial files
  });
  
  progress.report({ message: 'Validating spell...' });
  // ... validation
  
  progress.report({ message: 'Generating files...' });
  // ... generation
  
  progress.report({ message: 'Writing to workspace...' });
  // ... file writing
});
```

### Quick Actions

```typescript
// Success notification with actions
const action = await vscode.window.showInformationMessage(
  `✨ Spell "${name}" created successfully!`,
  'Open README',
  'Open Terminal',
  'Copy Config'
);

switch (action) {
  case 'Open README':
    // Open README.md in editor
    break;
  case 'Open Terminal':
    // Open terminal in spell directory
    break;
  case 'Copy Config':
    // Copy mcp.json snippet to clipboard
    break;
}
```

## Data Models

### MCP Config Snippet

```typescript
interface MCPConfigSnippet {
  mcpServers: {
    [name: string]: {
      command: string;
      args: string[];
    };
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Most of Milestone 8's requirements are UI behaviors that cannot be property-tested. The focus is on manual testing and code review.

### Property 1: Validation errors include field names
*For any* validation error, the error message SHALL include the name of the invalid field
**Validates: Requirements 2.1**

## Error Handling

- Validation errors: Show field name and expected format
- File system errors: Show path and OS error message
- Unexpected errors: Log to output channel, show generic message with "Show Details" action

## Testing Strategy

### Manual Testing Checklist

Since most requirements are UI behaviors, testing is manual:

1. **Progress Feedback**
   - [ ] Progress notification appears during generation
   - [ ] Progress updates show current step
   - [ ] Cancel button stops generation
   - [ ] Success notification appears on completion

2. **Error Handling**
   - [ ] Validation errors show field names
   - [ ] File errors show paths
   - [ ] "Show Details" opens output channel

3. **Quick Actions**
   - [ ] "Open README" opens the file
   - [ ] "Open Terminal" opens terminal in directory
   - [ ] "Copy Config" copies to clipboard

4. **Output Channel**
   - [ ] Channel appears in Output panel
   - [ ] Operations are logged with timestamps
   - [ ] Errors include stack traces
