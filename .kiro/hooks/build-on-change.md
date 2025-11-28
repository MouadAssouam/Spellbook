# Hook: Build on Change

Automatically rebuilds TypeScript when source files change.

## Configuration

```yaml
name: build-on-change
trigger: onSave
filePattern: "**/*.ts"
exclude: "**/*.test.ts"
action: shell
command: "npm run build"
```

## Purpose

This hook keeps the compiled JavaScript in sync with TypeScript source files. Essential for the MCP server which runs from compiled JS.

## Benefits

- Always have up-to-date compiled output
- MCP server stays in sync with source
- VS Code extension builds automatically
- No manual build step needed
