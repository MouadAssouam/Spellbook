# Design Document

## Overview

The Spellbook MCP Tool is the "meta moment" of the project - an MCP tool that creates other MCP tools. It exposes two tools via the Model Context Protocol: `create_spell` for generating new MCP servers and `list_spells` for viewing previously created spells. The tool uses file-based persistent storage to ensure spells survive restarts.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  SPELLBOOK MCP TOOL                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  MCP Server (spellbook-mcp.ts)                   │   │
│  │  - Server initialization                         │   │
│  │  - Tool registration                             │   │
│  │  - Request handlers                              │   │
│  └────────────────┬─────────────────────────────────┘   │
│                   │                                      │
│         ┌─────────┴─────────┐                           │
│         ▼                   ▼                           │
│  ┌─────────────┐     ┌─────────────┐                   │
│  │ create_spell│     │ list_spells │                   │
│  │   Handler   │     │   Handler   │                   │
│  └──────┬──────┘     └──────┬──────┘                   │
│         │                   │                           │
│         ▼                   ▼                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Storage Layer                                   │   │
│  │  - loadSpells(): Load from JSON file             │   │
│  │  - saveSpells(): Persist to JSON file            │   │
│  │  - File: .kiro/data/spells.json                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Core Package Integration                        │   │
│  │  - SpellSchema (validation)                      │   │
│  │  - generateMCPServer (file generation)           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### MCP Server

```typescript
// Server initialization
const server = new Server(
  { name: 'spellbook', version: '1.0.0' },
  { capabilities: { tools: {} } }
);
```

### Tool Definitions

```typescript
interface CreateSpellInput {
  name: string;           // 3-50 chars, kebab-case
  description: string;    // 100-500 chars
  inputSchema: object;    // JSON Schema
  outputSchema: object;   // JSON Schema
  action: Action;         // HTTP or Script
}

interface ListSpellsInput {
  // No parameters required
}
```

### Storage Interface

```typescript
interface SpellStorage {
  loadSpells(): Promise<Map<string, Spell>>;
  saveSpells(spells: Map<string, Spell>): Promise<void>;
}
```

## Data Models

### Stored Spell Format

Spells are stored as a JSON array in `.kiro/data/spells.json`:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "github-fetcher",
    "description": "...",
    "action": { "type": "http", "config": { ... } },
    "inputSchema": { ... },
    "outputSchema": { ... }
  }
]
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid spells generate complete file bundles
*For any* valid spell input to create_spell, the handler SHALL generate all four MCP server files and return a success response
**Validates: Requirements 1.1, 1.2**

### Property 2: Created spells are persisted
*For any* spell created via create_spell, the spell SHALL be retrievable via list_spells after creation
**Validates: Requirements 1.4, 2.1**

### Property 3: Storage round-trip preserves spells
*For any* set of created spells, saving to storage and loading back SHALL produce the same spells
**Validates: Requirements 2.3, 4.3**

### Property 4: Invalid spells are rejected with errors
*For any* invalid spell input (missing fields, invalid format), create_spell SHALL return an error response without persisting
**Validates: Requirements 1.2, 1.3**

## Error Handling

- **Validation Errors**: Return ZodError details in response
- **Storage Errors**: Log error, return graceful failure message
- **Corrupted Storage**: Start with empty spell map, log warning
- **Unknown Tool**: Throw error with tool name

## Testing Strategy

### Property-Based Testing

Using fast-check to verify properties:

```typescript
// Property: All valid spells can be created and listed
fc.assert(
  fc.asyncProperty(validSpellArbitrary, async (spellInput) => {
    await createSpellHandler(spellInput);
    const spells = await listSpellsHandler();
    return spells.some(s => s.name === spellInput.name);
  })
);
```

### Unit Tests

- Test create_spell with valid inputs
- Test create_spell with invalid inputs
- Test list_spells with empty storage
- Test list_spells with existing spells
- Test storage load/save functions
- Test corrupted storage handling

### Integration Tests

- Test full MCP server flow
- Test persistence across simulated restarts
