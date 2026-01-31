# Spellbook

[![npm version](https://img.shields.io/npm/v/spellbook-mcp.svg)](https://www.npmjs.com/package/spellbook-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)]()

**The MCP generator that tests your APIs**

> AI guesses from docs. Spellbook verifies with real requests.

---

## Why This Exists

You ask an AI to generate an MCP tool. It produces clean TypeScript. It compiles. It looks right.

Then you deploy it, and:

- The endpoint returns a different schema than the docs said
- The auth header format changed last month
- A field is sometimes null (the docs did not mention that)
- Your agent fails at 3am and nobody knows why

**The root cause**: AI cannot call APIs. It reads documentation and guesses. Documentation lies.

---

## The Difference

| Capability | AI Generators | Spellbook |
| --- | --- | --- |
| Generate MCP boilerplate | Yes | Yes |
| Actually call the API | No | Yes |
| Show you the real response | No | Yes |
| Infer schema from live data | No | Yes |
| Detect auth requirements | No | Yes |
| Tell you it works before you deploy | No | Yes |

**Spellbook does not generate code that should work. It generates code that already worked once.**

---

## How It Works

```text
1. Enter URL    -> https://api.github.com/users/{{username}}
2. Click Test   -> Spellbook calls the API with real values
3. See Response -> Status 200, actual JSON displayed
4. Review       -> Schema inferred from the real response
5. Generate     -> MCP server code that matches reality
```

The schema is not guessed from documentation. It is extracted from the actual API response you just saw.

---

## Quick Start

### VS Code Extension

1. Install from marketplace: search **Spellbook**
2. Open sidebar (Spellbook icon)
3. Paste API URL
4. Click **Test API**
5. See real response -> Generate

### npm Package

```bash
npm install @spellbook/core
```

```ts
import { magicFromUrl } from '@spellbook/core';

// One function: URL -> tested, verified spell
const result = await magicFromUrl('https://api.github.com/users/octocat');

if (result.success) {
  console.log(result.spell);
  // Schema was inferred from the actual response
  // Not guessed from docs
}
```

Or use the lower-level API:

```ts
import { generateMCPServerV2, inferSchema } from '@spellbook/core';

// Step 1: Test the API yourself
const response = await fetch('https://api.github.com/users/octocat');
const data = await response.json();

// Step 2: Infer schema from real data
const outputSchema = inferSchema(data);

// Step 3: Generate with verified schema
const spell = {
  id: crypto.randomUUID(),
  name: 'github-user',
  description: 'Fetches GitHub user profile. Schema verified against live API response.',
  transport: 'stdio',
  tools: [{
    name: 'get-user',
    description: 'Fetches a GitHub user by username. Returns profile data.',
    inputSchema: {
      type: 'object',
      properties: { username: { type: 'string' } },
      required: ['username']
    },
    outputSchema,
    action: {
      type: 'http',
      config: { url: 'https://api.github.com/users/{{username}}', method: 'GET' }
    }
  }]
};

const files = generateMCPServerV2(spell);
```

---

## OpenAPI Import

Have a Swagger spec? Import all endpoints at once:

```ts
import { parseOpenApiSpec } from '@spellbook/core';

const spec = await fetch('https://petstore.swagger.io/v2/swagger.json').then(r => r.text());
const parsed = parseOpenApiSpec(spec);

// parsed.tools = array of tool definitions
// parsed.auth = detected auth type (apiKey, bearer, oauth2)
```

---

## Bulk Test (New)

Bulk test imported endpoints in parallel, with rate limiting, retries, and schema drift detection.

### Sidebar (Discovery)
- Import OpenAPI
- Configure concurrency / timeout / RPS / retries
- Click **Bulk Test All**
- A report is saved as `spellbook-report.json`

### CLI (CI/CD)

```bash
spellbook test --all   --spells .kiro/data/spells.json   --report spellbook-report.json   --concurrency 6   --timeout 30000   --rps 10   --retries 2
```

Exit code is `2` if any endpoint fails, so it can be used as a CI gate.

---

## Generated Output

```text
your-tool/
|-- Dockerfile      # Node.js 20 Alpine, non-root user
|-- package.json    # Minimal dependencies
|-- index.js        # MCP server implementation
`-- README.md       # Usage instructions
```

Standard MCP server. Works with Claude Desktop, Cursor, Kiro, Windsurf, any MCP client.

---

## Runtime Utilities (Included)

The package includes optional utilities for common production patterns:

```ts
import { runtime } from '@spellbook/core';

// Structured logging
runtime.log.info('tool.called', { tool: 'get-user', input });

// Circuit breaker
const breaker = new runtime.CircuitBreaker({ threshold: 5, timeout: 30000 });
const result = await breaker.execute(() => fetch(url));

// Retry with backoff
const data = await runtime.retry(() => fetch(url), { maxAttempts: 3 });
```

These are simple defaults, not a framework. Use them or do not.

---

## Watch Mode

Automatic API change detection for generated tools.

```text
You enable Watch on a spell
    |
    v
Spellbook periodically calls the API
    |
    v
If the response schema changes
    |
    v
You get notified
    |
    v
One click to update the spell
```

AI generates once and forgets. Spellbook watches.

---

## What This Is NOT

- Not a deployment platform
- Not a runtime framework
- Not an observability suite
- Not trying to replace your existing tools

Spellbook does one thing: generate MCP tools from APIs you have actually tested.

---

## FAQ

**Can I just test manually after generating?**

You can. But then you already generated code based on guesses, deployed it, discovered the mismatch, and fixed it. Spellbook frontloads that discovery to before generation.

**Does this replace AI coding assistants?**

No. Use AI for the complex logic. Use Spellbook for the API integration parts. They work together.

**What about authenticated APIs?**

Set your auth type in the UI (API key, Bearer token, OAuth). Spellbook reads credentials from your environment variables during testing.

**What if the API requires a body?**

The UI lets you provide test values for URL parameters and request bodies.

---

## License

MIT
