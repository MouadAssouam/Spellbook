# 🧙 @spellbook/core

**MCP Tool Generator with Live API Verification**

[![npm version](https://img.shields.io/npm/v/spellbook-mcp.svg)](https://www.npmjs.com/package/spellbook-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Generate MCP tools from APIs you've actually tested.

## The Problem

AI generates MCP code that compiles but 500s at runtime. The schema was guessed from docs. Docs lie.

## The Solution

Test the API first. Infer schema from real response. Generate code that matches reality.

---

## Install

```bash
npm install spellbook-mcp
```

---

## Core API

### 1. Infer Schema from Real Data

```typescript
import { inferSchema } from 'spellbook-mcp';

const response = await fetch('https://api.github.com/users/octocat');
const data = await response.json();

const schema = inferSchema(data);
// → {
//     type: 'object',
//     properties: {
//       login: { type: 'string' },
//       id: { type: 'integer' },
//       avatar_url: { type: 'string' },
//       ...
//     }
//   }
```

### 2. Extract URL Parameters

```typescript
import { extractUrlParameters } from 'spellbook-mcp';

const params = extractUrlParameters('https://api.github.com/repos/{{owner}}/{{repo}}/issues');
// → ['owner', 'repo']
```

### 3. Generate MCP Server

```typescript
import { generateMCPServer, inferSchema } from 'spellbook-mcp';

// Test first
const testResponse = await fetch('https://api.github.com/users/octocat');
const testData = await testResponse.json();

const spell = {
  id: crypto.randomUUID(),
  name: 'github-user',
  description: 'Fetches GitHub user profile. Schema verified against live API.',
  transport: 'stdio',
  tools: [{
    name: 'get-user',
    description: 'Fetches a GitHub user by username.',
    inputSchema: {
      type: 'object',
      properties: { username: { type: 'string' } },
      required: ['username']
    },
    outputSchema: inferSchema(testData),  // ← From real response
    action: {
      type: 'http',
      config: {
        url: 'https://api.github.com/users/{{username}}',
        method: 'GET'
      }
    }
  }]
};

const files = generateMCPServer(spell);
// → { 'Dockerfile': '...', 'package.json': '...', 'index.js': '...', 'README.md': '...' }
```

### 4. Parse OpenAPI Specs

```typescript
import { parseOpenApiSpec } from 'spellbook-mcp';

const spec = await fetch('https://petstore.swagger.io/v2/swagger.json').then(r => r.text());
const parsed = parseOpenApiSpec(spec);

console.log(parsed.tools);  // All endpoints as tool definitions
console.log(parsed.auth);   // Detected auth type
```

---

## Generated Output

| File | Contents |
|------|----------|
| `Dockerfile` | Node.js 20 Alpine, non-root user |
| `package.json` | @modelcontextprotocol/sdk, ajv |
| `index.js` | MCP server with stdio transport |
| `README.md` | Usage instructions |

---

## Included Utilities

Simple, opinionated defaults for common needs:

```typescript
import { runtime } from 'spellbook-mcp';

// Structured logging
runtime.log.info('tool.called', { tool: 'get-user' });

// Retry with backoff
const data = await runtime.retry(() => fetch(url), { maxAttempts: 3 });

// Circuit breaker
const breaker = new runtime.CircuitBreaker({ threshold: 5 });
await breaker.execute(() => fetch(url));

// Health check
const health = runtime.createHealthChecker();
```

---

## Exports

```typescript
// Generator
export { generateMCPServer } from './generator.js';

// Schema inference (the differentiator)
export { inferSchema, extractUrlParameters } from './schema-inference.js';

// API Watcher (New!)
export { checkForChanges, diffSchemas } from './api-watcher.js';

// OpenAPI parsing
export { parseOpenApiSpec } from './openapi.js';

// Runtime utilities
export * as runtime from './runtime/index.js';
```

---

## Links

- [Main Repository](https://github.com/MouadAssouam/Spellbook)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=spellbook.spellbook-vscode)

## License

MIT
