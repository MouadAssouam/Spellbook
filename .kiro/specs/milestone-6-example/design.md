# Design Document

## Overview

Milestone 6 validates the Spellbook generator by testing with real example spells. This milestone creates integration tests that verify the complete generation pipeline produces valid, deployable MCP server files. The tests cover both HTTP and Script action types using the three pre-defined examples: GitHub Fetcher, Weather API, and Calculator.

## Architecture

The testing architecture validates the generator output at multiple levels:

```
┌─────────────────────────────────────────────────────────┐
│                    TEST ARCHITECTURE                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Example Spells (examples/)                      │   │
│  │  - github-fetcher.json                           │   │
│  │  - weather-api.json                              │   │
│  │  - calculator.json                               │   │
│  └────────────────┬─────────────────────────────────┘   │
│                   │                                      │
│                   ▼                                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Generator (generateMCPServer)                   │   │
│  │  - Validates spell                               │   │
│  │  - Calls templates                               │   │
│  │  - Returns file bundle                           │   │
│  └────────────────┬─────────────────────────────────┘   │
│                   │                                      │
│                   ▼                                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Integration Tests                               │   │
│  │  - Validate JSON structure                       │   │
│  │  - Validate Dockerfile syntax                    │   │
│  │  - Validate JS syntax                            │   │
│  │  - Validate README content                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Example Spell Files

JSON files in `examples/` directory containing complete spell definitions:

```typescript
interface ExampleSpellFile {
  id: string;           // UUID
  name: string;         // kebab-case name
  description: string;  // 100-500 chars
  action: Action;       // HTTP or Script
  inputSchema: object;  // JSON Schema
  outputSchema: object; // JSON Schema
}
```

### Integration Test Suite

Tests in `packages/core/src/examples.test.ts`:

```typescript
// Test structure
describe('Example Spells Integration', () => {
  describe('GitHub Fetcher', () => { /* ... */ });
  describe('Weather API', () => { /* ... */ });
  describe('Calculator', () => { /* ... */ });
});
```

## Data Models

### Example Spell Definitions

Three example spells covering different action types:

1. **GitHub Fetcher** (HTTP GET with URL interpolation)
2. **Weather API** (HTTP GET with multiple URL parameters)
3. **Calculator** (Script with arithmetic operations)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Generator produces complete file bundles
*For any* valid spell, the generator SHALL produce exactly four files: Dockerfile, package.json, index.js, and README.md
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Generated package.json is valid JSON with required dependencies
*For any* generated package.json, parsing with JSON.parse SHALL succeed AND the result SHALL contain @modelcontextprotocol/sdk and zod dependencies AND type SHALL equal "module"
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 3: Generated Dockerfile follows Node.js best practices
*For any* generated Dockerfile, the content SHALL contain "FROM node:20-alpine", "WORKDIR", "COPY package", and "npm ci"
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 4: Generated server code is syntactically valid JavaScript
*For any* generated index.js, the code SHALL be parseable as valid JavaScript (no syntax errors)
**Validates: Requirements 4.1**

### Property 5: HTTP action spells include fetch implementation
*For any* spell with HTTP action type, the generated server code SHALL contain "fetch(" and handle response
**Validates: Requirements 4.2**

### Property 6: Script action spells include Function constructor
*For any* spell with Script action type, the generated server code SHALL contain "new Function"
**Validates: Requirements 4.3**

### Property 7: URL interpolation is included when needed
*For any* spell with {{placeholder}} in URL or body, the generated server code SHALL contain the interpolate function
**Validates: Requirements 4.4**

### Property 8: README contains required documentation sections
*For any* generated README, the content SHALL include spell name as title, description, Docker build instructions, mcp.json example, and schema documentation
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 9: Example spells round-trip through JSON serialization
*For any* example spell, serializing to JSON and parsing back SHALL produce a spell that passes SpellSchema validation
**Validates: Requirements 6.1, 6.3**

## Error Handling

- Invalid spell definitions throw ZodError with field paths
- JSON parse errors are caught and reported clearly
- File system errors during example loading are handled gracefully

## Testing Strategy

### Property-Based Testing

Using fast-check to verify properties hold across generated outputs:

```typescript
import fc from 'fast-check';
import { generateMCPServer, SpellSchema } from '@spellbook/core';

// Property: All generated package.json files are valid JSON
fc.assert(
  fc.property(validSpellArbitrary, (spell) => {
    const files = generateMCPServer(spell);
    const pkg = JSON.parse(files['package.json']);
    return pkg.dependencies['@modelcontextprotocol/sdk'] !== undefined;
  })
);
```

### Integration Tests

Specific tests for each example spell:

```typescript
describe('GitHub Fetcher', () => {
  it('generates valid MCP server files', () => {
    const spell = loadExample('github-fetcher.json');
    const files = generateMCPServer(spell);
    
    expect(Object.keys(files)).toHaveLength(4);
    expect(files['index.js']).toContain('fetch(');
    expect(files['index.js']).toContain('interpolate');
  });
});
```

### Test Library

- **Vitest**: Test runner (already configured)
- **fast-check**: Property-based testing (already installed)
