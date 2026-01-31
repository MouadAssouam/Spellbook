# 🧙 Spellbook VS Code Extension

**MCP Tool Generator with Live API Verification**

> Test your API. See the real response. Generate code that works.

---

## The Problem You've Had

You use an AI to generate an MCP tool. It looks right. Docker builds.

You deploy it.

Then your agent starts failing silently because:
- The schema was guessed from docs (docs lie)
- Auth headers that worked locally fail in prod
- The endpoint changed and nobody noticed

**AI can't call your API. It can't test if the tool actually works.**

---

## What Spellbook Does

1. **You enter the API URL**
2. **Spellbook calls the API** (with real test values you provide)
3. **You see the actual response**
4. **Schema is inferred from real data**
5. **Code is generated that matches reality**

The tool you deploy already worked once.

---

## Quick Start (2 minutes)

### 1. Open Sidebar
Click the 🧙 icon in the Activity Bar.

### 2. Test Your API First
1. Add an HTTP tool with your URL
2. Click **"🧪 Test API"**
3. Enter real values when prompted (not `test_username`, but `octocat`)
4. See the actual response

### 3. Use the Schema
Click **"✨ Use This Schema"** to auto-populate from the real response.

### 4. Generate
Click **"🪄 Summon"** to generate your MCP server.

### 5. Run
```bash
cd your-tool
docker build -t your-tool .
```

Add to your MCP config:
```json
{
  "mcpServers": {
    "your-tool": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "your-tool"]
    }
  }
}
```

Done. Your tested, working MCP tool is ready.

---

## The Core Feature: Live Testing

| What You Do | What Happens |
|-------------|--------------|
| Enter `https://api.github.com/repos/{{owner}}/{{repo}}/issues` | Spellbook detects `{{owner}}` and `{{repo}}` placeholders |
| Click "🧪 Test API" | Modal asks for real values |
| Enter `owner: microsoft, repo: vscode` | Spellbook calls the actual API |
| See "✓ 200" + JSON response | You know it works |
| Click "Use This Schema" | Schema inferred from real data, not guessed |

**This is what AI cannot do.**

---

## Why Not Just Use AI?

| Capability | AI Generator | Spellbook |
|------------|--------------|-----------|
| Generate MCP boilerplate | ✅ | ✅ |
| Call the actual API | ❌ | ✅ |
| Show real response | ❌ | ✅ |
| Infer schema from live data | ❌ | ✅ |
| Detect auth errors before deploy | ❌ | ✅ |
| Watch for API changes | ❌ | ✅ (New!) |

---

## Watch Mode

Enable watching on any spell:

```
Spellbook periodically calls your API
    ↓
If the response schema changes
    ↓
You get notified immediately
    ↓
One click to update the spell
```

AI generates once and forgets. Spellbook watches.

---

## OpenAPI Import

Have a Swagger spec? Import all endpoints at once.

1. Find the **"📜 Import from OpenAPI"** section
2. Paste: `https://petstore.swagger.io/v2/swagger.json`
3. Click **"⚡ Auto-Import"**
4. All endpoints become tools

Auth type is auto-detected (API Key, Bearer, OAuth2).

---

## Generated Output

```
your-tool/
├── Dockerfile      # Node.js 20 Alpine
├── package.json    # Dependencies
├── index.js        # MCP server
└── README.md       # Usage
```

Standard MCP server. Works with Claude, Cursor, Kiro, any MCP client.

---

## HTTP vs Script

| Type | Use When |
|------|----------|
| **HTTP** | Calling APIs (GitHub, Slack, etc.) |
| **Script** | Custom logic (calculations, transforms) |

### HTTP Example
```
URL: https://api.github.com/users/{{username}}
Method: GET
```

### Script Example
```javascript
const { a, b } = input;
return { sum: a + b };
```

---

## Authentication

Set globally for all tools:

| Type | Header |
|------|--------|
| API Key | `X-API-Key: <value>` |
| Bearer | `Authorization: Bearer <value>` |
| OAuth 2.1 | Full flow with token refresh |

Auth is read from environment variables. Set the env var name in the UI.

---

## FAQ

**Why test before generating?**

Because AI guesses schemas. You ship, it 500s, you debug, you fix, you redeploy. Spellbook frontloads that discovery.

**What if my API requires auth?**

Set your env var in the Auth section. Spellbook uses it during testing.

**Can I edit the generated code?**

Yes. It's standard Node.js. Add what you need.

---

## Troubleshooting

**"Test API" shows error**
- Check the URL is correct
- Verify auth is configured
- Make sure the API is publicly accessible

**"Spell already exists"**
- A folder with that name exists
- Choose a different name or delete the folder

---

## Links

- [GitHub Repository](https://github.com/MouadAssouam/Spellbook)
- [npm Package](https://www.npmjs.com/package/spellbook-mcp)

---

**Test first. Ship working code. 🧙**
