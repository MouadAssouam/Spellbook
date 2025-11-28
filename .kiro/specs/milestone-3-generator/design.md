# Design Document - Milestone 3: Generator

## Overview

The generator engine is the core orchestration layer that combines type validation and template generation into a single, easy-to-use function. It validates spell definitions using Zod schemas and produces all files needed for a complete MCP server.

## Architecture

### Component Structure

```
packages/core/src/
├── types.ts          (existing - Spell definitions & validation)
├── templates.ts      (existing - template functions)
└── generator.ts      (new - orchestration layer)
```

### Data Flow

```
Spell Definition (user input)
    ↓
SpellSchema.parse() (validation)
    ↓
templates.dockerfile(spell)
templates.packageJson(spell)
templates.serverCode(spell)
templates.readme(spell)
    ↓
{ 'Dockerfile': '...', 'package.json': '...', ... }
```

## Components and Interfaces

### generator.ts Module

**Exports:**
```typescript
export function generateMCPServer(spell: Spell): Record<string, string>;
```

**Function Signature:**
```typescript
/**
 * Generates all files needed for an MCP server from a spell definition.
 * 
 * @param spell - Validated spell definition
 * @returns Object mapping filenames to file contents
 * @throws {ZodError} If spell validation fails
 */
function generateMCPServer(spell: Spell): Record<string, string>
```

## Data Models

### Input

```typescript
interface Spell {
  id: string;
  name: string;
  description: string;
  inputSchema: object;
  outputSchema: object;
  action: Action;
}
```

### Output

```typescript
type FileBundle = Record<string, string>;

// Example:
{
  'Dockerfile': '...',
  'package.json': '...',
  'index.js': '...',
  'README.md': '...'
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Complete file generation

*For any* valid spell, the generator should return exactly 4 files: Dockerfile, package.json, index.js, and README.md

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

### Property 2: Validation enforcement

*For any* invalid spell, the generator should throw a ZodError before attempting to generate files

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 3: Generator determinism

*For any* spell, calling the generator multiple times with the same spell should produce identical output

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 4: File bundle structure

*For any* generated file bundle, all keys should be valid filenames and all values should be non-empty strings

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 5: Action type support

*For any* spell with HTTP action, the generator should succeed; for any spell with script action, the generator should succeed

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

## Error Handling

### Validation Errors

When spell validation fails, the generator throws a ZodError:

```typescript
try {
  const files = generateMCPServer(invalidSpell);
} catch (error) {
  if (error instanceof z.ZodError) {
    // error.errors contains detailed validation failures
    console.error('Validation failed:', error.errors);
  }
}
```

### Template Errors

Templates are pure functions and should not throw errors. If they do, it indicates a bug in the template implementation.

## Testing Strategy

### Unit Tests

Test the generator function directly:

1. **Valid spell generation**
   - Generates all 4 files
   - Files have correct names
   - Files have non-empty content

2. **Invalid spell rejection**
   - Throws ZodError for invalid spells
   - Error messages are clear
   - No files generated on error

3. **Action type handling**
   - HTTP actions generate correct code
   - Script actions generate correct code

### Property-Based Tests

Use fast-check to generate random valid spells and verify properties:

1. **Complete file generation**: Always returns 4 files
2. **Validation enforcement**: Invalid spells always throw
3. **Generator determinism**: Same spell → same output
4. **File bundle structure**: Valid filenames and non-empty content
5. **Action type support**: Both HTTP and script actions work

### Integration Tests

Test the complete flow:

1. Create a test spell (e.g., GitHub Fetcher)
2. Generate files using generator
3. Verify all files are present
4. Verify file contents are valid
5. (Optional) Write files to temp directory and test Docker build

## Implementation Details

### Generator Function

```typescript
import { Spell, SpellSchema } from './types.js';
import { templates } from './templates.js';

export function generateMCPServer(spell: Spell): Record<string, string> {
  // Validate spell (throws ZodError if invalid)
  const validated = SpellSchema.parse(spell);
  
  // Generate all files using templates
  const files = {
    'Dockerfile': templates.dockerfile(validated),
    'package.json': templates.packageJson(validated),
    'index.js': templates.serverCode(validated),
    'README.md': templates.readme(validated)
  };
  
  return files;
}
```

### File Structure

The generator produces exactly 4 files:

1. **Dockerfile** - Container configuration
2. **package.json** - Node.js package metadata and dependencies
3. **index.js** - MCP server implementation
4. **README.md** - Documentation

## Security Considerations

1. **Input Validation**: All spells are validated before generation
2. **Template Safety**: Templates escape user input to prevent injection
3. **No File I/O**: Generator only returns strings, no filesystem access
4. **Deterministic Output**: Same input always produces same output

## Performance Considerations

- Generator is synchronous and fast (< 1ms for typical spells)
- No I/O operations
- No external dependencies beyond templates
- Memory usage is proportional to spell size (typically < 1KB)

## Future Enhancements

1. **Additional file types**: .gitignore, .dockerignore, tests
2. **Custom templates**: Allow users to provide custom templates
3. **Validation modes**: Strict vs permissive validation
4. **File compression**: Built-in ZIP creation
