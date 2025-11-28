# Design Document - Milestone 2: Templates

## Overview

The template system is responsible for generating all files needed for a complete MCP server from a Spell definition. It consists of four template functions that produce Dockerfile, package.json, server code, and README documentation.

## Architecture

### Component Structure

```
packages/core/src/
├── types.ts          (existing - Spell definitions)
└── templates.ts      (new - template functions)
```

### Template Functions

Each template is a pure function: `(spell: Spell) => string`

```typescript
export const templates = {
  dockerfile: (spell: Spell) => string,
  packageJson: (spell: Spell) => string,
  serverCode: (spell: Spell) => string,
  readme: (spell: Spell) => string
};
```

## Components and Interfaces

### templates.ts Module

**Exports:**
```typescript
export const templates: {
  dockerfile: (spell: Spell) => string;
  packageJson: (spell: Spell) => string;
  serverCode: (spell: Spell) => string;
  readme: (spell: Spell) => string;
};
```

**Internal Helpers:**
```typescript
// Generate action-specific code
function generateActionCode(action: Action): string;

// Escape strings for safe embedding in code
function escapeString(str: string): string;

// Format JSON with proper indentation
function formatJson(obj: any): string;
```

## Data Models

### Template Input

All templates receive a validated `Spell` object:

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

### Template Output

All templates return a `string` containing the complete file content.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Template determinism

*For any* spell, calling a template function multiple times with the same spell should produce identical output

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 2: Valid Dockerfile syntax

*For any* spell, the generated Dockerfile should be parseable by Docker and contain all required directives (FROM, WORKDIR, COPY, RUN, CMD)

**Validates: Requirements 1.1, 1.2, 1.4, 1.5, 7.2**

### Property 3: Valid package.json structure

*For any* spell, the generated package.json should be valid JSON and contain required fields (name, version, type, main, dependencies)

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.3**

### Property 4: Valid server code syntax

*For any* spell, the generated server code should be syntactically valid JavaScript and contain MCP protocol implementation

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 7.4**

### Property 5: Action type handling

*For any* spell with HTTP action, the generated code should contain fetch calls; for any spell with script action, the generated code should contain script execution logic

**Validates: Requirements 3.5, 3.6, 6.1, 6.2**

### Property 6: HTTP configuration completeness

*For any* spell with HTTP action that includes headers, the generated code should include those headers in the fetch call; for any spell with HTTP action that includes a body, the generated code should include that body

**Validates: Requirements 6.3, 6.4**

### Property 7: README completeness

*For any* spell, the generated README should contain the spell name, description, Docker build instructions, mcp.json example, and schema documentation

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.5**

### Property 8: Template interpolation support

*For any* spell with HTTP action containing {{variable}} placeholders, the generated code should include interpolation logic that replaces placeholders with input values

**Validates: Requirements 3.8**

## Error Handling

### Input Validation

Templates assume input is a valid `Spell` (already validated by Zod). No additional validation is performed.

### Template Errors

Templates are pure functions and should not throw errors. If invalid data is somehow passed, TypeScript types will catch it at compile time.

### Generated Code Errors

Generated server code includes error handling:
- Invalid tool names return MCP error responses
- Schema validation failures return clear error messages
- HTTP failures are caught and returned as MCP errors
- Script execution errors are caught and returned as MCP errors

## Testing Strategy

### Unit Tests

Test each template function individually:

1. **Dockerfile template**
   - Contains FROM node:20-alpine
   - Contains WORKDIR /app
   - Contains COPY and RUN commands
   - Contains CMD to start server
   - Valid Docker syntax

2. **package.json template**
   - Valid JSON structure
   - Contains required dependencies
   - Has correct name format
   - Has type: "module"
   - Has correct main entry point

3. **Server code template**
   - Contains MCP SDK imports
   - Contains Server initialization
   - Contains ListToolsRequestSchema handler
   - Contains CallToolRequestSchema handler
   - Contains stdio transport setup
   - HTTP action generates fetch code
   - Script action generates execution code
   - Headers included when present
   - Body included when present

4. **README template**
   - Contains spell name as title
   - Contains description
   - Contains Docker build command
   - Contains mcp.json example
   - Contains input schema
   - Contains output schema

### Property-Based Tests

Use fast-check to generate random valid spells and verify properties:

1. **Determinism**: Same spell → same output
2. **Syntax validity**: All outputs are syntactically valid
3. **Required content**: All outputs contain required elements
4. **Action handling**: HTTP vs script actions generate different code
5. **Configuration completeness**: Optional fields are included when present

### Integration Tests

Test that generated files work together:

1. Generate all files for a test spell
2. Write files to temp directory
3. Run `docker build` (requires Docker)
4. Verify build succeeds
5. Run container and test MCP protocol

## Implementation Details

### Dockerfile Template

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "index.js"]
```

### package.json Template

```json
{
  "name": "spell-{spell.name}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  }
}
```

### Server Code Template Structure

```javascript
// Imports
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Schema definitions
const inputSchema = z.object({...});

// Server setup
const server = new Server({
  name: '{spell.name}',
  version: '1.0.0'
}, {
  capabilities: { tools: {} }
});

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: '{spell.name}',
    description: '{spell.description}',
    inputSchema: {...}
  }]
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== '{spell.name}') {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }
  
  const input = inputSchema.parse(request.params.arguments);
  const result = await executeAction(input);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify(result)
    }]
  };
});

// Action execution
async function executeAction(input) {
  // HTTP or Script action code here
}

// Transport setup
const transport = new StdioServerTransport();
await server.connect(transport);
```

### README Template Structure

```markdown
# {spell.name}

{spell.description}

## Installation

\`\`\`bash
docker build -t {spell.name} .
\`\`\`

## Usage in Kiro

Add to `.kiro/settings/mcp.json`:

\`\`\`json
{
  "mcpServers": {
    "{spell.name}": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "{spell.name}"]
    }
  }
}
\`\`\`

## Input Schema

\`\`\`json
{inputSchema}
\`\`\`

## Output Schema

\`\`\`json
{outputSchema}
\`\`\`
```

## Security Considerations

1. **Code Injection**: Template interpolation must escape user input properly
2. **Command Injection**: Docker commands use safe arguments
3. **Dependency Security**: Use specific versions of dependencies
4. **Script Execution**: Script actions execute in isolated Docker containers

## Performance Considerations

- Templates are pure functions (no I/O)
- String concatenation is fast for small files
- No external dependencies needed
- Synchronous execution is acceptable
