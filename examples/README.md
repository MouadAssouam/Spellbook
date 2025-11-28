# 📚 Example Spells

This directory contains example spell definitions that demonstrate Spellbook's capabilities.

## Available Examples

### 🐙 GitHub Fetcher (`github-fetcher.json`)

**Use Case:** Fetch issues from any GitHub repository.

**Action Type:** HTTP GET

**Input Parameters:**
- `owner` - GitHub username or organization
- `repo` - Repository name

**Example Usage:**
```
Fetch issues from microsoft/vscode
```

---

### 🌤️ Weather API (`weather-api.json`)

**Use Case:** Get current weather data for any city.

**Action Type:** HTTP GET

**Input Parameters:**
- `city` - City name
- `apiKey` - OpenWeatherMap API key

**Example Usage:**
```
Get weather for London
```

**Note:** Requires an OpenWeatherMap API key.

---

### 🧮 Calculator (`calculator.json`)

**Use Case:** Perform basic arithmetic operations.

**Action Type:** JavaScript Script

**Input Parameters:**
- `a` - First number
- `b` - Second number
- `operation` - One of: `add`, `subtract`, `multiply`, `divide`

**Example Usage:**
```
Calculate 42 + 8
```

---

## Using Examples

### In VS Code Extension

1. Run "Spellbook: Create MCP Tool"
2. Select "Use Example Spell"
3. Choose an example
4. Modify as needed
5. Generate!

### Programmatically

```typescript
import { generateMCPServer } from '@spellbook/core';
import githubFetcher from './github-fetcher.json';

const files = generateMCPServer(githubFetcher);
// files = { 'Dockerfile': '...', 'package.json': '...', ... }
```

## Creating Your Own

Use these examples as templates for your own spells. Key fields:

```json
{
  "id": "uuid-here",
  "name": "my-spell",
  "description": "100-500 character description...",
  "action": {
    "type": "http",
    "config": {
      "url": "https://api.example.com/{{param}}",
      "method": "GET"
    }
  },
  "inputSchema": { "type": "object", "properties": { ... } },
  "outputSchema": { "type": "object" }
}
```
