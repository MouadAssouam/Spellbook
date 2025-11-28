# Design Document

## Overview

This design defines the core type system for Spellbook using Zod schemas with TypeScript type inference. The types model spell definitions that generate MCP tools, supporting both HTTP and script-based actions.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TYPE SYSTEM                           │
├─────────────────────────────────────────────────────────┤
│  SpellSchema                                             │
│  ├── id: UUID                                            │
│  ├── name: string (3-50, kebab-case)                     │
│  ├── description: string (100-500)                       │
│  ├── inputSchema: object (JSON Schema)                   │
│  ├── outputSchema: object (JSON Schema)                  │
│  └── action: ActionSchema (discriminated union)          │
│       ├── { type: 'http', config: HTTPConfigSchema }     │
│       └── { type: 'script', config: ScriptConfigSchema } │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### File: packages/core/src/types.ts

```typescript
import { z } from 'zod';

// HTTP Config Schema
export const HTTPConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  headers: z.record(z.string()).optional(),
  body: z.string().optional()
});

// Script Config Schema
export const ScriptConfigSchema = z.object({
  runtime: z.literal('node'),
  code: z.string().min(1)
});

// Action Schema (discriminated union)
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('http'), config: HTTPConfigSchema }),
  z.object({ type: z.literal('script'), config: ScriptConfigSchema })
]);

// Spell Schema
export const SpellSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(50).regex(/^[a-zA-Z0-9-]+$/),
  description: z.string().min(100).max(500),
  inputSchema: z.object({}).passthrough(),
  outputSchema: z.object({}).passthrough(),
  action: ActionSchema
});

// Inferred Types
export type HTTPConfig = z.infer<typeof HTTPConfigSchema>;
export type ScriptConfig = z.infer<typeof ScriptConfigSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Spell = z.infer<typeof SpellSchema>;
```

## Data Models

### Spell
| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| id | string | UUID v4 | Unique identifier |
| name | string | 3-50 chars, `/^[a-zA-Z0-9-]+$/` | Tool name (kebab-case) |
| description | string | 100-500 chars | What the tool does |
| inputSchema | object | passthrough | JSON Schema for input |
| outputSchema | object | passthrough | JSON Schema for output |
| action | Action | discriminated union | HTTP or Script config |

### HTTPConfig
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | Valid URL, supports `{{var}}` |
| method | enum | Yes | GET, POST, PUT, PATCH, DELETE |
| headers | Record<string, string> | No | HTTP headers |
| body | string | No | Request body template |

### ScriptConfig
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| runtime | 'node' | Yes | Execution runtime |
| code | string | Yes | JavaScript code (min 1 char) |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid spells pass validation
*For any* spell object with valid id (UUID), name (3-50 alphanumeric+hyphens), description (100-500 chars), inputSchema (object), outputSchema (object), and valid action, SpellSchema.safeParse SHALL return success: true
**Validates: Requirements 1.1**

### Property 2: Name validation regex
*For any* string, if it matches `/^[a-zA-Z0-9-]+$/` and length is 3-50, the name validation SHALL pass; otherwise it SHALL fail
**Validates: Requirements 1.2**

### Property 3: Description length validation
*For any* string, if length is between 100 and 500 inclusive, description validation SHALL pass; otherwise it SHALL fail
**Validates: Requirements 1.3**

### Property 4: HTTP action validation
*For any* HTTP config with valid URL and method in [GET, POST, PUT, PATCH, DELETE], HTTPConfigSchema.safeParse SHALL return success: true regardless of optional headers/body presence
**Validates: Requirements 2.1, 2.2**

### Property 5: Script action validation
*For any* script config with runtime='node' and non-empty code string, ScriptConfigSchema.safeParse SHALL return success: true
**Validates: Requirements 3.1**

### Property 6: Validation errors include field paths
*For any* invalid spell input, the returned ZodError.errors array SHALL contain objects with non-empty path arrays identifying the invalid field
**Validates: Requirements 4.1**

## Error Handling

```typescript
// Safe parsing pattern
const result = SpellSchema.safeParse(data);
if (!result.success) {
  // result.error is ZodError with detailed errors
  const errors = result.error.errors.map(e => ({
    path: e.path.join('.'),
    message: e.message,
    code: e.code
  }));
  return { success: false, errors };
}
// result.data is typed as Spell
return { success: true, data: result.data };
```

## Testing Strategy

### Unit Tests
- Test each schema with valid inputs
- Test each schema with invalid inputs
- Test error message quality

### Property-Based Tests
- Use fast-check to generate random valid/invalid inputs
- Test validation boundaries (min/max lengths)
- Test regex patterns with generated strings
- Library: fast-check (npm install fast-check)
- Minimum iterations: 100 per property
- Tag format: `**Feature: milestone-1-types, Property {number}: {property_text}**`
