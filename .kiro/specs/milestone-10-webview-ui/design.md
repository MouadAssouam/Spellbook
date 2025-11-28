# Design Document

## Overview

This milestone adds a Webview-based Grimoire UI to the Spellbook VS Code extension. The webview provides a visual spell builder with real-time validation, code preview, and a polished dark theme with gold accents.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VS CODE EXTENSION                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  WEBVIEW PANEL (Grimoire UI)                     │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │  Spell Form                                │  │   │
│  │  │  - Name input (kebab-case validation)      │  │   │
│  │  │  - Description textarea (char count)       │  │   │
│  │  │  - Action type selector (HTTP/Script)      │  │   │
│  │  │  - Dynamic config fields                   │  │   │
│  │  │  - Example buttons                         │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │  Preview Tabs                              │  │   │
│  │  │  - Dockerfile | package.json | index.js   │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────┐  │   │
│  │  │  Actions                                   │  │   │
│  │  │  [Preview] [Summon Spell ✨]               │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↕ postMessage                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  EXTENSION HOST                                  │   │
│  │  - GrimoirePanel class                           │   │
│  │  - Message handlers                              │   │
│  │  - @spellbook/core integration                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### GrimoirePanel Class

```typescript
class GrimoirePanel {
  public static currentPanel: GrimoirePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  
  public static createOrShow(extensionUri: vscode.Uri): void;
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri);
  private _getHtmlForWebview(webview: vscode.Webview): string;
  private _handleMessage(message: WebviewMessage): void;
}
```

### Message Protocol

```typescript
// Webview → Extension
type WebviewMessage = 
  | { type: 'validate'; data: Partial<SpellFormData> }
  | { type: 'preview'; data: SpellFormData }
  | { type: 'generate'; data: SpellFormData }
  | { type: 'loadExample'; example: string };

// Extension → Webview
type ExtensionMessage =
  | { type: 'validationResult'; errors: ValidationError[] }
  | { type: 'previewResult'; files: Record<string, string> }
  | { type: 'generateResult'; success: boolean; message: string }
  | { type: 'exampleLoaded'; data: SpellFormData };
```

## Data Models

### SpellFormData

```typescript
interface SpellFormData {
  name: string;
  description: string;
  actionType: 'http' | 'script';
  // HTTP config
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  // Script config
  code?: string;
}
```

## Grimoire Theme (CSS)

```css
:root {
  --grimoire-bg: #1a120b;
  --grimoire-surface: #2d1f14;
  --grimoire-gold: #d4af37;
  --grimoire-gold-dim: #8b7355;
  --grimoire-text: #f4e8d8;
  --grimoire-error: #ff6b6b;
  --grimoire-success: #4ecdc4;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Webview-Extension Message Round Trip
*For any* valid spell form data sent from webview, the extension should process it and return a response message
**Validates: Requirements 1.1, 4.1**

### Property 2: Validation Consistency
*For any* spell form data, validation in the webview should match validation in the extension (Zod schema)
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Preview Matches Generation
*For any* valid spell form data, the preview output should exactly match what gets written to disk
**Validates: Requirements 3.1, 4.1**

### Property 4: Example Loading Preserves Structure
*For any* example spell loaded, all form fields should be populated with valid data that passes validation
**Validates: Requirements 5.2, 5.3**

## Error Handling

- Invalid form data: Show inline errors, disable submit button
- Generation failure: Show error message in webview, keep form data
- Webview disposal: Clean up resources, allow reopening

## Testing Strategy

### Unit Tests
- Test message serialization/deserialization
- Test form validation logic
- Test HTML generation

### Property-Based Tests
- Use fast-check to generate random form data
- Verify validation consistency between webview and extension
- Verify preview matches generation output

### Manual Testing
- Visual inspection of grimoire theme
- Test all form interactions
- Test example loading
- Test error states
