# Spellbook: Code Style & Architecture Guide

This steering document guides Kiro in generating consistent, high-quality code for Spellbook.

---

## Architecture Overview: The Compiler Pipeline

Spellbook is architecturally a **domain-specific compiler** for MCP tools:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  SCHEMA LAYER   │ ──▶ │ TEMPLATE ENGINE │ ──▶ │   GENERATOR     │
│  (Frontend)     │     │ (Middle-end)    │     │   (Backend)     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ • Zod schemas   │     │ • dockerfile()  │     │ • Validation    │
│ • Type checking │     │ • packageJson() │     │ • Orchestration │
│ • Input parsing │     │ • serverCode()  │     │ • File emission │
│ • Validation    │     │ • readme()      │     │ • Bundle output │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     LEXER/PARSER            IR TRANSFORMS           CODE EMISSION
```

| Compiler Phase | Spellbook Equivalent |
|----------------|---------------------|
| Lexer/Parser | Zod schema parsing (`SpellSchema.parse()`) |
| Semantic Analysis | Validation rules (name regex, description length) |
| IR Generation | Template functions (pure transforms) |
| Optimization | Conditional interpolation (only include when needed) |
| Code Emission | `generateMCPServer()` → file bundle |

**Key property**: Deterministic - same input always produces identical output.

---

## TypeScript Conventions

### Strict Mode
- Always use `strict: true` in tsconfig
- No `any` types - use `unknown` and type guards
- Enable all strict checks

### Naming Conventions
- **Files**: kebab-case (`spell-form.ts`, `mcp-server.ts`)
- **Types/Interfaces**: PascalCase (`Spell`, `HTTPConfig`)
- **Functions**: camelCase (`generateMCPServer`, `validateSpell`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_DESCRIPTION_LENGTH`)
- **Spell names**: kebab-case (`github-fetcher`, `slack-notifier`)

### Imports
```typescript
// Order: external, internal, types
import { z } from 'zod';
import { generateMCPServer } from './generator.js';
import type { Spell, Action } from './types.js';
```

### Functions
- Keep functions small (< 50 lines)
- Single responsibility
- Use descriptive names (no abbreviations)
- Document with JSDoc for public APIs

---

## Validation: Two-Layer Strategy

### Build-Time: Zod (Schema Layer)
```typescript
// Define schema first, infer type
export const SpellSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(50).regex(/^[a-zA-Z0-9-]+$/),
  description: z.string().min(100).max(500),
  // ...
});

// Infer type from schema
export type Spell = z.infer<typeof SpellSchema>;

// Always use safeParse for user input
const result = SpellSchema.safeParse(data);
if (!result.success) {
  return { error: result.error.errors };
}
```

### Runtime: Ajv (Generated Servers)
Generated MCP servers use Ajv for JSON Schema validation at runtime:
```typescript
import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true, coerceTypes: true });
const validateInput = ajv.compile(inputSchema);

if (!validateInput(input)) {
  const errors = validateInput.errors?.map(e => `${e.instancePath} ${e.message}`).join(', ');
  throw new Error(`Invalid input: ${errors}`);
}
```

---

## Webview Patterns (Vanilla HTML/JS)

Spellbook uses vanilla HTML/JS for webviews (no React) for simplicity and bundle size.

### Provider Structure
```typescript
export class GrimoireSidebarProvider implements vscode.WebviewViewProvider {
  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.html = this._getHtmlForWebview();
    webviewView.webview.onDidReceiveMessage(msg => this._handleMessage(msg));
  }
  
  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>...`; // Inline HTML with <style> and <script>
  }
}
```

### VS Code Webview Communication
```typescript
// Extension → Webview
this._view.webview.postMessage({ type: 'spellsList', spells });

// Webview → Extension
vscode.postMessage({ type: 'generate', data: getFormData() });
```

---

## MCP Server Patterns

### Tool Registration
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'tool-name',
    description: 'Clear description',
    inputSchema: { /* JSON Schema */ }
  }]
}));
```

### Error Handling
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    // ... handle request
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
});
```

### CRITICAL: No console.log
- stdio transport breaks with console.log
- Use proper MCP error responses instead

---

## File Organization

```
packages/core/src/
├── types.ts          # Zod schemas and types (SCHEMA LAYER)
├── templates.ts      # Code generation templates (TEMPLATE ENGINE)
├── generator.ts      # Main generator logic (GENERATOR)
├── storage.ts        # Spell persistence
├── spellbook-mcp.ts  # MCP server entry point
└── index.ts          # Public exports

extensions/vscode/src/
├── extension.ts      # Entry point
├── commands/
│   └── create-spell.ts   # QuickPick spell creation flow
├── providers/
│   ├── GrimoireSidebarProvider.ts  # Sidebar webview
│   └── SpellsProvider.ts           # Tree data provider
├── webview/
│   └── GrimoirePanel.ts            # Full panel webview
└── utils/
    ├── examples.ts       # Example spell definitions
    ├── logger.ts         # Output channel logging
    ├── schema-builder.ts # Interactive schema builder
    └── validation.ts     # Input validation helpers
```

---

## Error Handling

### User-Facing Errors
```typescript
// Clear, actionable messages
throw new Error('Spell name must be 3-50 characters (letters, numbers, hyphens only)');
```

### Internal Errors
```typescript
// Use logger utility (not console.log in MCP context)
import { error } from '../utils/logger';
error('Failed to generate spell', err instanceof Error ? err : undefined);
```

---

## Testing

### Property-Based Tests (fast-check)
- Test correctness properties across random inputs
- Verify template determinism
- Test validation boundaries

### Unit Tests
- Test pure functions
- Test Zod schemas with valid/invalid inputs
- Test template output structure

### Integration Tests
- Test full generation flow
- Test example spells round-trip
- Test storage persistence

---

## Theme: Haunted Grimoire Aesthetic

### CSS Variables (Sidebar)
```css
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
```

### CSS Variables (Panel - Original)
```css
--grimoire-bg: #1a120b;
--grimoire-surface: #2d1f14;
--grimoire-gold: #d4af37;
--grimoire-text: #f4e8d8;
```

### UI Elements
- Dark backgrounds with gold accents
- Floating particle animations
- Eerie glow effects on interactive elements
- Ancient book / magical tome aesthetic
- Mystical iconography (✨, 🔮, 📜, 👻, 🕯️)

### Tone
- "Summon" instead of "Generate"
- "Spell" instead of "Tool Definition"
- "Grimoire" instead of "Library"
- "Conjure" instead of "Create"
- "Ingredients" instead of "Parameters"
- "Ritual Type" instead of "Action Type"
