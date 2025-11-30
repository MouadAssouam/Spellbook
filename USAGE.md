# 🔮 How to Use Spellbook

This guide walks you through creating your first MCP tool with Spellbook — from zero to working tool in minutes.

**Three ways to use Spellbook:**
- [Method 1: VS Code Extension](#method-1-vs-code-extension-sidebar) — Visual UI, best for beginners
- [Method 2: MCP Tool via Kiro](#method-2-mcp-tool-conversational) — Ask Kiro to create spells for you
- [Method 3: npm Library](#method-3-npm-library-programmatic) — Integrate into your own tools

---

## Method 1: VS Code Extension (Sidebar)

The visual way — perfect if you want to see what you're building.

### Step 1: Open the Grimoire Sidebar

Click the 🔮 **Spellbook icon** in the Activity Bar (left side of VS Code/Kiro).

<!-- TODO: Screenshot of activity bar with Spellbook icon highlighted -->

You'll see the Haunted Grimoire sidebar with two tabs:
- **📜 Grimoire** — Your saved spells
- **🕯️ Conjure** — Create new spells

### Step 2: Start Creating a Spell

Click the **"🕯️ Conjure"** tab. You'll see the spell creation form.

**Quick start:** Click one of the example buttons (🐙 GitHub, 🌤️ Weather, 🧮 Calculator) to pre-fill the form with a working example.

### Step 3: Fill in the Spell Details

| Field | What to enter | Example |
|-------|---------------|---------|
| **Spell Name** | kebab-case, 3-50 chars | `github-issue-fetcher` |
| **Description** | 100-500 chars explaining what it does | `Fetches open issues from any GitHub repository. Useful for tracking bugs, feature requests, and project status across multiple repos.` |
| **Ritual Type** | HTTP Request or JavaScript Script | `HTTP Request` |

### Step 4: Configure the Action

**For HTTP spells:**

| Field | Example |
|-------|---------|
| **URL** | `https://api.github.com/repos/{{owner}}/{{repo}}/issues` |
| **Method** | `GET` |
| **Headers** (optional) | `Authorization: Bearer {{token}}` |

**For Script spells:**

```javascript
const { a, b, operation } = input;
switch(operation) {
  case 'add': return { result: a + b };
  case 'subtract': return { result: a - b };
  case 'multiply': return { result: a * b };
  case 'divide': return { result: a / b };
}
```

### Step 5: Add Ingredients (Parameters)

Click **"+ Add Ingredient"** for each input your spell needs:

| Name | Type | Required |
|------|------|----------|
| `owner` | string | ✅ |
| `repo` | string | ✅ |

These become the inputs users provide when calling your tool.

### Step 6: Summon the Spell! 🕯️

Click **"🕯️ SUMMON FROM THE VOID 🕯️"**

Spellbook generates 4 files in your workspace:

```
github-issue-fetcher/
├── Dockerfile        # Container configuration
├── package.json      # Dependencies
├── index.js          # MCP server code
└── README.md         # Usage instructions
```

### Step 7: Build and Use Your Spell

```bash
cd github-issue-fetcher
docker build -t github-issue-fetcher .
```

Add to your `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "github-issue-fetcher": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "github-issue-fetcher"]
    }
  }
}
```

**That's it!** Ask Kiro: *"Fetch issues from microsoft/vscode"* and your spell will run.

---

## Method 2: MCP Tool (Conversational)

The meta way — use Kiro to create MCP tools through conversation.

### Step 1: Add Spellbook to Your MCP Config

Add to `.kiro/settings/mcp.json`:

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

Restart Kiro or reconnect MCP servers.

### Step 2: Ask Kiro to Create a Spell

Just describe what you want:

> "Create a spell that fetches GitHub issues from any repository"

Kiro will use the `mcp_spellbook_create_spell` tool to generate your MCP server.

### Step 3: More Examples

**HTTP API spell:**
> "Create a spell called weather-checker that gets weather data from OpenWeatherMap for any city"

**Script spell:**
> "Create a calculator spell that can add, subtract, multiply, and divide two numbers"

**With authentication:**
> "Create a spell that posts messages to Slack using a webhook URL"

### Step 4: List Your Spells

> "List all my spells"

Kiro will use `mcp_spellbook_list_spells` to show your created spells.

### Step 5: Use the Generated Spell

The files are generated in your workspace. Build and configure as shown in Method 1, Step 7.

---

## Method 3: npm Library (Programmatic)

The developer way — integrate Spellbook into your own tools.

### Step 1: Install the Package

```bash
npm install spellbook-mcp
```

### Step 2: Define Your Spell

```typescript
import { generateMCPServer, SpellSchema } from 'spellbook-mcp';

const spell = {
  id: crypto.randomUUID(),
  name: 'github-issue-fetcher',
  description: 'Fetches open issues from any GitHub repository. Useful for tracking bugs, feature requests, and project status across multiple repos.',
  inputSchema: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: 'GitHub username or organization' },
      repo: { type: 'string', description: 'Repository name' }
    },
    required: ['owner', 'repo']
  },
  outputSchema: { 
    type: 'array',
    description: 'List of GitHub issues'
  },
  action: {
    type: 'http',
    config: {
      url: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues',
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  }
};
```

### Step 3: Generate the MCP Server

```typescript
const files = generateMCPServer(spell);

// files = {
//   'Dockerfile': '...',
//   'package.json': '...',
//   'index.js': '...',
//   'README.md': '...'
// }
```

### Step 4: Write Files to Disk

```typescript
import { writeFileSync, mkdirSync } from 'fs';

const outputDir = `./${spell.name}`;
mkdirSync(outputDir, { recursive: true });

for (const [filename, content] of Object.entries(files)) {
  writeFileSync(`${outputDir}/${filename}`, content);
}

console.log(`✨ Spell generated at ${outputDir}/`);
```

### Step 5: Validate Before Generating (Optional)

```typescript
import { SpellSchema } from 'spellbook-mcp';

const result = SpellSchema.safeParse(spell);

if (!result.success) {
  console.error('Invalid spell:', result.error.errors);
  process.exit(1);
}

// Safe to generate
const files = generateMCPServer(result.data);
```

---

## Template Variables

Use `{{variableName}}` syntax in URLs, headers, and body. These get replaced with user input at runtime.

**URL example:**
```
https://api.github.com/repos/{{owner}}/{{repo}}/issues
```

**Header example:**
```
Authorization: Bearer {{token}}
```

**Body example:**
```json
{
  "message": "{{text}}",
  "channel": "{{channel}}"
}
```

When called with `owner=microsoft, repo=vscode`, the URL becomes:
```
https://api.github.com/repos/microsoft/vscode/issues
```

---

## Running Without Docker

Don't have Docker? Run the generated server directly:

```bash
cd your-spell
npm install
node index.js
```

Update your mcp.json:

```json
{
  "mcpServers": {
    "your-spell": {
      "command": "node",
      "args": ["./your-spell/index.js"]
    }
  }
}
```

---

## Complete Example: Building a Slack Notifier

Let's build a spell that posts messages to Slack.

### 1. The Spell Definition

```json
{
  "name": "slack-notifier",
  "description": "Posts messages to a Slack channel via webhook. Useful for sending alerts, notifications, and updates from automated workflows.",
  "action": {
    "type": "http",
    "config": {
      "url": "{{webhookUrl}}",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json"
      },
      "body": "{\"text\": \"{{message}}\"}"
    }
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "webhookUrl": { "type": "string", "description": "Slack webhook URL" },
      "message": { "type": "string", "description": "Message to post" }
    },
    "required": ["webhookUrl", "message"]
  }
}
```

### 2. Generate with Any Method

**Extension:** Fill the form, click Summon
**MCP:** "Create a slack-notifier spell that posts messages via webhook"
**Library:** `generateMCPServer(spell)`

### 3. Use It

```bash
docker build -t slack-notifier .
```

```json
{
  "mcpServers": {
    "slack-notifier": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "slack-notifier"]
    }
  }
}
```

Ask Kiro: *"Send 'Build complete!' to my Slack channel"*

---

## Troubleshooting

### "Spell name must be kebab-case"
Use only lowercase letters, numbers, and hyphens: `my-spell-name`

### "Description must be 100-500 characters"
Add more detail about what your spell does, why it's useful, and what inputs it expects.

### "Generated tool doesn't respond"
1. Make sure Docker is running
2. Check the mcp.json path is correct
3. Try running `node index.js` directly to see errors

### "Template variables not replaced"
Make sure you're using `{{variableName}}` syntax (double curly braces) and the variable name matches your input schema.

---

## What's Next?

- Check out [examples/](./examples/) for more spell definitions
- Read the [architecture docs](./README.md#️-architecture) to understand how Spellbook works
- See [KIRO-USAGE.md](./.kiro/KIRO-USAGE.md) for how this project was built with Kiro

**Happy spell casting! 🔮✨**
