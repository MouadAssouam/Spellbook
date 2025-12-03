# 🔮 Spellbook

[![npm version](https://img.shields.io/npm/v/spellbook-mcp.svg)](https://www.npmjs.com/package/spellbook-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-71%20passing-brightgreen.svg)]()

**Visual MCP Tool Builder for VS Code and all forks**

> For developers who want to build MCP tools without writing boilerplate.

Build MCP (Model Context Protocol) tools in 30 seconds instead of hours. 

**Optimized for Kiro** — fully tested and working. Support for other VS Code forks (Cursor, Windsurf, etc.) coming soon.

<!-- TODO: Add screenshot/GIF of the Haunted Grimoire sidebar here -->

## 😫 The Problem

Creating an MCP tool today requires:
- Understanding MCP protocol (stdio, JSON-RPC)
- Setting up Node.js project structure
- Writing ~100 lines of server boilerplate
- Handling input validation manually
- Setting up Docker for deployment
- Writing documentation

**Time: 2-4 hours per tool** for someone who knows what they're doing.

## ✅ The Solution

With Spellbook:
1. Fill in name, description, URL or script
2. Click "Summon"
3. Get a complete, working MCP server

**Time: 30 seconds.**

### Three Ways to Use Spellbook

| Method | Install | Best For |
|--------|---------|----------|
| **npm package** | `npx spellbook-mcp` | Zero setup, works anywhere |
| **VS Code Extension** | Search "Spellbook" in Extensions | Visual UI, sidebar, live preview |
| **MCP Tool** | Add to mcp.json | Conversational creation via Kiro |

**Fastest way:** Just add to your `mcp.json` and ask Kiro to create spells - no clone, no build, no extension needed.

## 📑 Table of Contents

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [The Meta Moment](#-the-meta-moment)
- [Features](#-features)
- [Project Stats](#-project-stats)
- [Architecture](#️-architecture)
- [Installation](#-installation)
- [Usage Guide](#-usage-guide) ⬅️ **Start here!**
- [Quick Start](#-quick-start)
- [Generated Output](#-generated-output)
- [Example Spells](#-example-spells)
- [Self-Enforcing Architecture](#️-self-enforcing-architecture)
- [Development](#️-development)
- [Project Structure](#-project-structure)
- [Kiroween Hackathon](#-kiroween-hackathon)
- [License](#-license)

---

## ✨ The Meta Moment

**Spellbook is an MCP tool that builds MCP tools.** 🤯

You can use Spellbook inside Kiro to create more MCP tools, including another Spellbook!

---

## 🎯 Features

- **Haunted Grimoire Sidebar** - Embedded spell builder with spooky animations and live preview
- **Visual Spell Builder** - Create MCP tools through command palette or sidebar
- **Zero Boilerplate** - Generates Dockerfile, package.json, server code, and README
- **HTTP & Script Actions** - Support for API calls and custom JavaScript logic
- **Template Variables** - Use `{{var}}` syntax in URLs, headers, and body
- **Persistent Storage** - Spells are saved to `.kiro/data/spells.json`
- **Example Spells** - Start from pre-built examples (GitHub Fetcher, Weather API, Calculator)
- **Compiler Architecture** - Schema → Templates → Generator pipeline
- **Two-Layer Validation** - Zod at build-time, Ajv at runtime
- **Self-Enforcing Architecture** - Prevents invalid, broken, or inconsistent tools

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| Test Count | **71 passing** |
| Time Saved | **75%** (36h → 9h with Kiro) |
| Source Lines | ~1,400 |
| Generated Files | 4 per spell |

```
npm test
 ✓ 6 test files | 71 tests passed
```

---

## 🏗️ Architecture

Spellbook is a **domain-specific compiler** for MCP tools:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  SCHEMA LAYER   │ ──▶ │ TEMPLATE ENGINE │ ──▶ │   GENERATOR     │
│     (Zod)       │     │  (Pure funcs)   │     │ (File emission) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
   Spell JSON ──────────────────────────────────▶ MCP Server Files
```

**Three components:**
1. **VS Code Extension** - Haunted Grimoire UI for spell creation
2. **Core Compiler** - Schema validation → Template transforms → File generation
3. **MCP Tool** - `create_spell` and `list_spells` via stdio

**Two-layer validation:** Zod validates at build-time, Ajv validates at runtime in generated servers.

---

## 📖 Usage Guide

**New to Spellbook?** Check out the **[Complete Usage Guide](./USAGE.md)** for step-by-step tutorials on:

- 🎨 **VS Code Extension** — Visual sidebar walkthrough with screenshots
- 💬 **MCP Tool** — Create spells by chatting with Kiro
- 📦 **npm Library** — Programmatic integration for your own tools
- 🧪 **Complete Examples** — Build a Slack notifier from scratch

---

## 📥 Installation

### npm Package (Fastest)

```bash
# Use directly with npx (no install needed)
npx spellbook-mcp

# Or install as a library
npm install spellbook-mcp
```

### MCP Tool (Conversational)

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

### VS Code Extension

**Option A: Install from Marketplace (Recommended)**

1. Open VS Code / Kiro / Cursor / Windsurf
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for **"Spellbook"**
4. Click **Install**

Or install via command line:
```bash
code --install-extension MouadAssouam.spellbook-vscode
```

**Option B: Download from GitHub**

1. Download `spellbook-vscode-0.1.1.vsix` from [Releases](https://github.com/MouadAssouam/Spellbook/releases)
2. Open VS Code / Kiro / Cursor / Windsurf
3. Go to Extensions (`Ctrl+Shift+X`)
4. Click `...` → **Install from VSIX...**
5. Select the downloaded `.vsix` file

**Option C: Build from source**
```bash
cd extensions/vscode
npm install
npm run package
```

---

## 🚀 Quick Start

### VS Code Extension

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **"Spellbook: Create MCP Tool"**
3. Choose "Create New Spell" or "Use Example Spell"
4. Fill in the spell details:
   - **Name**: kebab-case, 3-50 characters (e.g., `github-fetcher`)
   - **Description**: 100-500 characters explaining what it does
   - **Action Type**: HTTP Request or JavaScript Script
5. Watch the magic happen! ✨

### MCP Tool (Meta Mode)

**Option A: Via npx (no install needed)**

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

**Option B: From source**

```bash
git clone https://github.com/MouadAssouam/Spellbook.git
cd Spellbook && npm install && npm run build
```

```json
{
  "mcpServers": {
    "spellbook": {
      "command": "node",
      "args": ["./packages/core/dist/spellbook-mcp.js"]
    }
  }
}
```

Then use it in Kiro:
- `create_spell` - Create a new MCP tool
- `list_spells` - List all your spells

---

## 📦 Generated Output

For each spell, Spellbook generates a complete MCP server:

```
your-spell/
├── Dockerfile        # Container configuration (Node.js 20 Alpine)
├── package.json      # Dependencies (@modelcontextprotocol/sdk, ajv)
├── index.js          # MCP server with stdio transport & Ajv validation
└── README.md         # Usage instructions with mcp.json config
```

### Using Your Generated Spell

```bash
# Build the Docker image
cd your-spell
docker build -t your-spell .

# Add to mcp.json
{
  "mcpServers": {
    "your-spell": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "your-spell"]
    }
  }
}
```

---

## 🎯 Example Spells

### GitHub Fetcher
```json
{
  "name": "github-fetcher",
  "action": {
    "type": "http",
    "config": {
      "url": "https://api.github.com/repos/{{owner}}/{{repo}}/issues",
      "method": "GET"
    }
  }
}
```

### Weather API
```json
{
  "name": "weather-api",
  "action": {
    "type": "http",
    "config": {
      "url": "https://api.openweathermap.org/data/2.5/weather?q={{city}}&appid={{apiKey}}",
      "method": "GET"
    }
  }
}
```

### Calculator
```json
{
  "name": "calculator",
  "action": {
    "type": "script",
    "config": {
      "runtime": "node",
      "code": "const { a, b, op } = input; return { result: op === 'add' ? a + b : a - b };"
    }
  }
}
```

> **Note:** Template variables (`{{var}}`) work in URLs, headers, and request bodies.

---

## 🛡️ Self-Enforcing Architecture

**Spellbook doesn't just generate code. It ENFORCES the rules.**

| Rule | Enforcement |
|------|-------------|
| Kebab-case names | Regex validation |
| Name length (3-50) | Min/max validation |
| Description (100-500 chars) | Length validation |
| Valid URL format | URL schema validation |
| Valid HTTP method | Enum validation |
| Non-empty script code | Min length validation |
| Consistent output | Always: `Dockerfile`, `package.json`, `index.js`, `README.md` |
| Runtime validation | Ajv in generated servers |
| Duplicate prevention | Storage validation |

**Without Self-Enforcement:**
```
/your-tool/
    read_me.md        ← wrong name
    dockerFile        ← wrong case
```

**With Spellbook:**
```
/your-spell/
    Dockerfile        ✓ exact name
    package.json      ✓ exact name
    index.js          ✓ exact name  
    README.md         ✓ exact name
```

---

## 🛠️ Development

```bash
npm install      # Install dependencies
npm run build    # Build all packages
npm test         # Run tests
npm run clean    # Clean build artifacts
```

---

## 📁 Project Structure

```
spellbook/
├── packages/core/          # THE COMPILER
│   └── src/
│       ├── types.ts        # Schema Layer (Zod)
│       ├── templates.ts    # Template Engine
│       ├── generator.ts    # Generator
│       └── spellbook-mcp.ts
├── extensions/vscode/      # VS Code Extension
│   └── src/
│       ├── providers/      # Sidebar webview
│       ├── commands/       # Command handlers
│       └── webview/        # Grimoire panel
├── examples/               # Example spells
└── .kiro/                  # Specs, steering, hooks
```

---

## 🏆 Kiroween Hackathon

Built for the [Kiroween Hackathon](https://kiro.devpost.com) in the **Frankenstein** category.

### 🧟 Why Frankenstein?

Spellbook is a chimera stitched from incompatible parts:

| Component | Domain |
|-----------|--------|
| VS Code Extension | Frontend UX |
| MCP Stdio Server | Backend Protocol |
| Template Engine | Code Generation |
| Ajv JSON Schema | Runtime Validation |
| Docker Containerization | Deployment |
| Recursive Meta-tooling | 🤯 |

These domains normally never live together. Spellbook merges them into a single recursive system that **builds tools that build tools... that can build themselves.**

### 🔧 How We Used Kiro

See [.kiro/KIRO-USAGE.md](.kiro/KIRO-USAGE.md) for detailed documentation on how Kiro assisted with:
- Spec-driven development (12 milestones)
- Steering rules for architecture consistency
- Property-based testing (71 tests)
- Bug detection & fixes

**Time saved: 75%** (36h manual → 9h with Kiro)

---

## 🚀 Roadmap

Features planned for future updates:

| Feature | Description |
|---------|-------------|
| **Auto-register to mcp.json** | Automatically add generated tools to your MCP config |
| **npm install automation** | Run npm install after generating files |
| **Edit existing spells** | Modify spells from the Grimoire sidebar |
| **Multi-tool servers** | Generate servers with multiple tools |
| **Authentication templates** | Built-in OAuth, API key, and Bearer token support |
| **Import from OpenAPI** | Generate spells from OpenAPI/Swagger specs |
| **Spell sharing** | Export/import spell definitions |

Have a feature request? [Open an issue](https://github.com/MouadAssouam/Spellbook/issues)!

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
