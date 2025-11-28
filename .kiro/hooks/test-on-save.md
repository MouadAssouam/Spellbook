# Hook: Run Tests on Save

Automatically runs tests when TypeScript files are saved in the core package.

## Configuration

```yaml
name: test-on-save
trigger: onSave
filePattern: "packages/core/src/**/*.ts"
exclude: "**/*.test.ts"
action: shell
command: "npm test"
```

## Purpose

This hook ensures that any changes to the core package are immediately validated against the test suite. With 62 property-based tests, this catches regressions early.

## Benefits

- Immediate feedback on code changes
- Catches type errors and validation issues
- Ensures templates generate valid output
- Validates generator determinism
