# Design Document

## Overview

This feature replaces the separate Grimoire webview panel with an embedded sidebar webview. The sidebar will contain a tabbed interface allowing users to switch between viewing existing spells and creating new ones, all within the Activity Bar panel.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VS CODE SIDEBAR                       │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  TABS: [My Spells] [Create Spell ✨]              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  TAB CONTENT (WebviewView)                        │  │
│  │                                                    │  │
│  │  My Spells Tab:                                   │  │
│  │  ├─ github-fetcher                                │  │
│  │  ├─ weather-api                                   │  │
│  │  └─ calculator                                    │  │
│  │                                                    │  │
│  │  Create Spell Tab:                                │  │
│  │  ┌────────────────────────────────────────────┐   │  │
│  │  │  📚 Examples: [GitHub] [Weather] [Calc]    │   │  │
│  │  ├────────────────────────────────────────────┤   │  │
│  │  │  📛 Spell Name: [____________]             │   │  │
│  │  │  📝 Description: [____________]            │   │  │
│  │  │  ⚡ Action: (•) HTTP  ( ) Script           │   │  │
│  │  │  🔗 URL: [____________]                    │   │  │
│  │  │  📤 Method: [GET ▼]                        │   │  │
│  │  ├────────────────────────────────────────────┤   │  │
│  │  │  [✨ Summon Spell]                         │   │  │
│  │  └────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────┘  │
│                          ↕ postMessage                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │  EXTENSION HOST                                   │  │
│  │  - GrimoireSidebarProvider (WebviewViewProvider)  │  │
│  │  - Message handlers                               │  │
│  │  - @spellbook/core integration                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### GrimoireSidebarProvider Class

```typescript
class GrimoireSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'spellbook.grimoireView';
  
  private _view?: vscode.WebviewView;
  
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void;
  
  private _getHtmlForWebview(webview: vscode.Webview): string;
  private _handleMessage(message: WebviewMessage): void;
  
  public refresh(): void;
  public switchToSpellsTab(): void;
}
```

### Message Protocol

```typescript
// Webview → Extension
type WebviewMessage = 
  | { type: 'validate'; data: Partial<SpellFormData> }
  | { type: 'generate'; data: SpellFormData }
  | { type: 'loadExample'; example: string }
  | { type: 'getSpells' }
  | { type: 'switchTab'; tab: 'spells' | 'create' };

// Extension → Webview
type ExtensionMessage =
  | { type: 'validationResult'; errors: ValidationError[] }
  | { type: 'generateResult'; success: boolean; message: string }
  | { type: 'exampleLoaded'; data: SpellFormData }
  | { type: 'spellsList'; spells: SpellInfo[] }
  | { type: 'tabChanged'; tab: 'spells' | 'create' };
```

## Data Models

### SpellFormData

```typescript
interface SpellFormData {
  name: string;
  description: string;
  actionType: 'http' | 'script';
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  code?: string;
}

interface SpellInfo {
  name: string;
  description: string;
  path: string;
}
```

## Sidebar Layout (Compact CSS)

```css
:root {
  --grimoire-bg: #1a120b;
  --grimoire-surface: #2d1f14;
  --grimoire-gold: #d4af37;
  --grimoire-text: #f4e8d8;
  --grimoire-error: #ff6b6b;
}

body {
  padding: 8px;
  font-size: 12px;
}

.form-group {
  margin-bottom: 12px;
}

input, textarea, select {
  width: 100%;
  padding: 8px;
  font-size: 12px;
}

textarea {
  min-height: 60px;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Validation Consistency
*For any* spell form data entered in the sidebar, validation errors should match the Zod schema validation from @spellbook/core
**Validates: Requirements 1.3**

### Property 2: Example Loading Populates Form
*For any* example spell clicked, all corresponding form fields should be populated with the example's data
**Validates: Requirements 5.2**

## Error Handling

- Invalid form data: Show inline errors below fields, disable Summon button
- Generation failure: Show error message, keep form data for correction
- Workspace not open: Show message prompting user to open a folder
- Webview disposal: Clean up resources, allow re-resolution

## Testing Strategy

### Unit Tests
- Test message serialization/deserialization
- Test form validation logic
- Test HTML generation for sidebar

### Property-Based Tests
- Use fast-check library for property-based testing
- Test validation consistency between sidebar and core
- Test example loading populates all fields correctly

### Manual Testing
- Visual inspection of compact sidebar layout
- Test tab switching behavior
- Test form interactions in narrow width
- Test spell creation end-to-end
