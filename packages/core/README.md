# 🔮 spellbook-mcp

**MCP Tool Generator - Create MCP servers in 30 seconds**

[![npm version](https://img.shields.io/npm/v/spellbook-mcp.svg)](https://www.npmjs.com/package/spellbook-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is this?

Spellbook generates complete MCP (Model Context Protocol) servers from simple definitions. No boilerplate, no setup - just describe what you want and get a working tool.

## Quick Start

### Use as MCP Tool (Conversational)

Add to your `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "spellbook": {
      "command": "npx",
      "args": ["spellbook-mcp"]
    }
  }
}
```

Then ask Kiro: *"Create a spell that fetches GitHub issues"*

### Use as Library

```bash
npm install spellbook-mcp
```

```typescript
import { generateMCPServer, SpellSchema } from 'spellbook-mcp';

const spell = {
  id: crypto.randomUUID(),
  name: 'github-fetcher',
  description: 'Fetches GitHub issues by repository. Useful for tracking bugs and features across projects.',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string' },
      repo: { type: 'string' }
    },
    required: ['owner', 'repo']
  },
  outputSchema: { type: 'array' },
  action: {
    type: 'http',
    config: {
      url: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues',
      method: 'GET'
    }
  }
};

const files = generateMCPServer(spell);
// files = {
//   'Dockerfile': '...',
//   'package.json': '...',
//   'index.js': '...',
//   'README.md': '...'
// }
```

## Generated Output

For each spell, Spellbook generates:

| File | Purpose |
|------|---------|
| `Dockerfile` | Container config (Node.js 20 Alpine) |
| `package.json` | Dependencies (@modelcontextprotocol/sdk, ajv) |
| `index.js` | MCP server with stdio transport |
| `README.md` | Usage instructions |

## Action Types

### HTTP Action
```typescript
action: {
  type: 'http',
  config: {
    url: 'https://api.example.com/{{resource}}',
    method: 'GET',
    headers: { 'Authorization': 'Bearer {{token}}' },
    body: '{"key": "{{value}}"}'
  }
}
```

### Script Action
```typescript
action: {
  type: 'script',
  config: {
    runtime: 'node',
    code: 'const { a, b } = input; return { result: a + b };'
  }
}
```

## Validation Rules

| Field | Rule |
|-------|------|
| name | 3-50 chars, kebab-case |
| description | 100-500 chars |
| url | Valid URL format |
| code | Non-empty |

## API

### `generateMCPServer(spell: Spell): Record<string, string>`

Generates all MCP server files from a spell definition.

### `validateSpell(data: unknown): ValidationResult`

Validates a spell definition against the schema.

### `SpellSchema`

Zod schema for spell validation.

## Links

- [Full Documentation](https://github.com/MouadAssouam/Spellbook)
- [VS Code Extension](https://github.com/MouadAssouam/Spellbook/releases)
- [Examples](https://github.com/MouadAssouam/Spellbook/tree/main/examples)

## License

MIT
