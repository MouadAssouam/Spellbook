# 🔮 Spellbook VS Code Extension

**Build MCP tools in 30 seconds, not hours.**

## What is this?

Spellbook lets you create MCP (Model Context Protocol) tools visually. Instead of writing boilerplate code, you fill in a form and Spellbook generates everything you need.

## Quick Start (2 minutes)

### Step 1: Open the Sidebar
Click the 🔮 Spellbook icon in the Activity Bar (left side of VS Code).

### Step 2: Create Your First Spell
1. Click the **"🕯️ Conjure"** tab
2. Click an example button (try **🐙 GitHub**)
3. Click **"🕯️ SUMMON FROM THE VOID 🕯️"**

### Step 3: Use Your Generated Tool
```bash
cd github-fetcher
docker build -t github-fetcher .
```

Add to `.kiro/settings/mcp.json`:
```json
{
  "mcpServers": {
    "github-fetcher": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "github-fetcher"]
    }
  }
}
```

Done! Your MCP tool is ready to use.

---

## FAQ

### What is an MCP tool?

MCP (Model Context Protocol) tools are plugins that AI assistants like Kiro can use. When you create a spell, you're creating a tool that Kiro can call during conversations.

### What gets generated?

For each spell, Spellbook creates 4 files:

| File | Purpose |
|------|---------|
| `Dockerfile` | Container config (Node.js 20 Alpine) |
| `package.json` | Dependencies |
| `index.js` | The actual MCP server code |
| `README.md` | Usage instructions |

### What's the difference between HTTP and Script?

- **HTTP** - Makes API calls (GitHub, Weather, Slack, etc.)
- **Script** - Runs JavaScript code (calculations, transforms, etc.)

### What are template variables `{{var}}`?

Placeholders that get replaced with user input at runtime:
```
https://api.github.com/repos/{{owner}}/{{repo}}/issues
```
When called with `owner=microsoft, repo=vscode`, becomes:
```
https://api.github.com/repos/microsoft/vscode/issues
```

### Why do I need Docker?

Docker packages your tool so it runs the same everywhere. No "works on my machine" problems.

If you don't have Docker, you can also run directly:
```bash
cd your-spell
npm install
node index.js
```

### What are the validation rules?

| Field | Rule |
|-------|------|
| Name | 3-50 characters, kebab-case (letters, numbers, hyphens) |
| Description | 100-500 characters |
| URL | Must be valid URL format |
| Code | Cannot be empty (for script actions) |

### Can I edit the generated code?

Yes! The generated files are yours. Edit `index.js` to customize behavior, add error handling, or extend functionality.

---

## Commands

| Command | Description |
|---------|-------------|
| `Spellbook: Create MCP Tool` | Open the QuickPick wizard |
| `Spellbook: Open Grimoire` | Open the full panel view |
| `Refresh Spells` | Reload the spells list |

---

## Troubleshooting

### "Spell already exists"
A folder with that name already exists in your workspace. Choose a different name or delete the existing folder.

### "Description must be at least 100 characters"
Add more detail about what your tool does. Explain the use case, inputs, and outputs.

### Generated tool doesn't work
1. Check the `index.js` for syntax errors
2. Verify your URL is correct (test in browser first)
3. Make sure Docker is running
4. Check the MCP config path is correct

### Sidebar not showing
1. Click the 🔮 icon in the Activity Bar
2. If missing, reload VS Code (`Ctrl+Shift+P` → "Reload Window")

---

## Examples

### GitHub Issues Fetcher
Fetches issues from any GitHub repository.
- **Type**: HTTP GET
- **URL**: `https://api.github.com/repos/{{owner}}/{{repo}}/issues`
- **Inputs**: owner, repo

### Weather API
Gets current weather for a city.
- **Type**: HTTP GET  
- **URL**: `https://api.openweathermap.org/data/2.5/weather?q={{city}}&appid={{apiKey}}`
- **Inputs**: city, apiKey

### Calculator
Performs arithmetic operations.
- **Type**: Script
- **Code**: `const { a, b, op } = input; return { result: op === 'add' ? a + b : a - b };`
- **Inputs**: a, b, operation

---

## Glossary

| Term | Meaning |
|------|---------|
| **Spell** | A tool definition (name, description, action, inputs) |
| **Grimoire** | The spell library / UI |
| **Summon** | Generate the MCP server files |
| **Conjure** | Create a new spell |
| **Ingredients** | Input parameters for your spell |

---

---

## Deep Dive: How Spellbook Works

### The Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  You fill   │ ──▶ │  Spellbook  │ ──▶ │  Generator  │ ──▶ │  4 files    │
│  the form   │     │  validates  │     │  creates    │     │  ready!     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Step-by-Step: What Happens When You Click "Summon"

**1. Form Data Collection**
```javascript
{
  name: "github-fetcher",
  description: "Fetches GitHub issues...",
  actionType: "http",
  url: "https://api.github.com/repos/{{owner}}/{{repo}}/issues",
  method: "GET",
  parameters: [
    { name: "owner", type: "string", required: true },
    { name: "repo", type: "string", required: true }
  ]
}
```

**2. Validation (Zod Schema)**
- Name: 3-50 chars, kebab-case only
- Description: 100-500 chars
- URL: Valid format (allows `{{var}}` placeholders)
- Parameters: Valid identifiers

If validation fails → Error shown, no files created.

**3. Template Generation**

Spellbook generates 4 files using pure template functions:

**Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
CMD ["node", "index.js"]
```

**package.json:**
```json
{
  "name": "spell-github-fetcher",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ajv": "^8.12.0"
  }
}
```

**index.js** (simplified):
```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Ajv from 'ajv';

// Validate inputs with Ajv
const ajv = new Ajv({ allErrors: true });
const validateInput = ajv.compile(inputSchema);

// Register the tool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'github-fetcher',
    description: 'Fetches GitHub issues...',
    inputSchema: { /* your parameters */ }
  }]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const input = request.params.arguments;
  
  // Validate input
  if (!validateInput(input)) {
    throw new Error('Invalid input');
  }
  
  // Make the HTTP request (with {{var}} replaced)
  const url = `https://api.github.com/repos/${input.owner}/${input.repo}/issues`;
  const response = await fetch(url);
  return { content: [{ type: 'json', json: await response.json() }] };
});

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
```

**README.md:**
- Installation instructions
- mcp.json configuration
- Input/output schemas

**4. File Writing**
Files are written to `your-workspace/spell-name/`.

---

### How the Generated MCP Server Works

When Kiro (or any MCP client) calls your tool:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Kiro      │ ──▶ │  Your MCP   │ ──▶ │  External   │
│   calls     │     │  Server     │     │  API        │
│   tool      │     │  (index.js) │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      │  stdin/stdout     │   HTTP request    │
      │  (JSON-RPC)       │                   │
      ▼                   ▼                   ▼
   Request:            Validates          Returns:
   {                   input with         { issues: [...] }
     owner: "ms",      Ajv, then
     repo: "vscode"    fetches data
   }
```

**Communication Protocol:**
- MCP uses **stdio** (stdin/stdout) for communication
- Messages are **JSON-RPC** format
- That's why `console.log()` breaks things - it corrupts the protocol!

---

### HTTP Action Deep Dive

For HTTP spells, the generated code:

1. **Interpolates variables** - Replaces `{{owner}}` with actual value
2. **Sets timeout** - 15 seconds max
3. **Validates host** - Can restrict to specific domains
4. **Limits response size** - 10MB max
5. **Parses JSON** - Returns structured data

```javascript
// Template variable interpolation
function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : '';
  });
}

// URL becomes: https://api.github.com/repos/microsoft/vscode/issues
const url = interpolate('https://api.github.com/repos/{{owner}}/{{repo}}/issues', input);
```

---

### Script Action Deep Dive

For script spells, the generated code:

1. **Creates a Function** - From your code string
2. **Sets timeout** - 5 seconds max
3. **Passes input** - Your parameters as `input` object
4. **Returns result** - Must be JSON-serializable

```javascript
// Your code runs in a Function constructor
const fn = new Function('input', 'const { a, b, op } = input; return { result: a + b };');

// Called with input object
const result = fn({ a: 5, b: 3, op: 'add' });
// Returns: { result: 8 }
```

⚠️ **Security Note:** Script actions run with full Node.js privileges. Only use trusted code.

---

### Validation Deep Dive

**Two layers of validation:**

| Layer | When | Tool | Purpose |
|-------|------|------|---------|
| Build-time | When you click Summon | Zod | Validates spell definition |
| Runtime | When tool is called | Ajv | Validates user inputs |

**Build-time (Zod):**
```typescript
const SpellSchema = z.object({
  name: z.string().min(3).max(50).regex(/^[a-zA-Z0-9-]+$/),
  description: z.string().min(100).max(500),
  // ...
});
```

**Runtime (Ajv in generated server):**
```javascript
const inputSchema = {
  type: 'object',
  properties: {
    owner: { type: 'string' },
    repo: { type: 'string' }
  },
  required: ['owner', 'repo']
};

const validateInput = ajv.compile(inputSchema);
if (!validateInput(input)) {
  throw new Error('Invalid input: owner must be string');
}
```

---

### The Architecture (It's a Compiler!)

Spellbook is actually a **domain-specific compiler**:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  SCHEMA LAYER   │ ──▶ │ TEMPLATE ENGINE │ ──▶ │   GENERATOR     │
│  (Zod)          │     │ (Pure functions)│     │ (File emission) │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ • Parse input   │     │ • dockerfile()  │     │ • Validate      │
│ • Type check    │     │ • packageJson() │     │ • Transform     │
│ • Validate      │     │ • serverCode()  │     │ • Write files   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Source language:** Spell JSON definition
**Target language:** MCP server files (JS, Docker, etc.)

Same input always produces identical output (deterministic).

---

## Need Help?

- Check the [main README](../../README.md) for project overview
- See [examples/](../../examples/) for more spell definitions
- See [.kiro/KIRO-USAGE.md](../../.kiro/KIRO-USAGE.md) for how this was built

---

**Happy spell casting! 🔮✨**
