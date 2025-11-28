# Spellbook: Challenges & Solutions

This document tracks problems encountered and how they were solved.

---

## Challenge 1: JSON Schema → Zod Conversion Bug (CRITICAL)

**Date:** November 27, 2025
**Milestone:** 2 (Templates)

**Problem:**
Generated servers embedded JSON Schema directly into `z.object()`:
```typescript
const inputSchema = z.object({ "type": "object", "properties": {...} });
```
This caused `TypeError: keyValidator._parse is not a function` because Zod expects Zod validators, not JSON Schema objects.

**Attempted Solutions:**
1. Convert JSON Schema to Zod at generation time - Too complex, many edge cases
2. Use `z.any()` - Loses all validation
3. Use Ajv JSON Schema validator - ✅ Works perfectly

**Final Solution:**
```typescript
import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true });
const validateInput = ajv.compile(inputSchema);

// In handler:
if (!validateInput(input)) {
  const errors = validateInput.errors?.map(e => `${e.instancePath} ${e.message}`).join(', ');
  throw new Error(`Invalid input: ${errors}`);
}
```

**Lessons Learned:**
- JSON Schema and Zod are not interchangeable
- Always test generated code with real inputs
- Property-based tests with string checks don't catch runtime errors

**Time Spent:** 30 minutes

---

## Challenge 2: Header Interpolation Missing

**Date:** November 27, 2025
**Milestone:** 2 (Templates)

**Problem:**
Template variables (`{{token}}`) worked in URLs and body but NOT in headers. Headers like `Authorization: Bearer {{token}}` stayed literal.

**Root Cause:**
`generateActionCode()` only checked URL and body for `{{` patterns, not headers.

**Final Solution:**
```typescript
if (headers && Object.keys(headers).length > 0) {
  const headersNeedInterpolation = Object.values(headers).some(v => v.includes('{{'));
  if (headersNeedInterpolation) {
    const headerEntries = Object.entries(headers).map(([k, v]) => {
      if (v.includes('{{')) {
        return `'${escapeString(k)}': interpolate(${JSON.stringify(v)}, input)`;
      }
      return `'${escapeString(k)}': ${JSON.stringify(v)}`;
    });
    fetchOptions.push(`headers: {\n      ${headerEntries.join(',\n      ')}\n    }`);
  }
}
```

**Lessons Learned:**
- Feature promises must be tested end-to-end
- Interpolation should be consistent across all fields

**Time Spent:** 15 minutes

---

## Challenge 3: VS Code Extension Dist Out of Sync

**Date:** November 27, 2025
**Milestone:** 4-8 (Extension)

**Problem:**
`extensions/vscode/dist/` contained stale compiled code. Source had logger, progress, quick actions - dist still had console.log.

**Root Cause:**
Forgot to run `npm run compile` after source changes.

**Final Solution:**
```bash
cd extensions/vscode
npm run compile
```

**Lessons Learned:**
- Add build step to CI/CD
- Consider watch mode during development
- Verify dist matches source before packaging

**Time Spent:** 5 minutes

---

## Challenge 4: Storage Validation Gap

**Date:** November 27, 2025
**Milestone:** 7 (MCP Tool)

**Problem:**
`loadSpells()` loaded JSON without validation. Corrupted or malicious entries could break the system.

**Final Solution:**
```typescript
const validSpells = new Map<string, Spell>();
for (const item of parsed) {
  const result = SpellSchema.safeParse(item);
  if (result.success) {
    validSpells.set(result.data.id, result.data);
  }
  // Invalid spells silently skipped
}
```

**Lessons Learned:**
- Always validate data at boundaries
- Fail gracefully, don't crash on bad data

**Time Spent:** 10 minutes

---

## Challenges Summary

| # | Challenge | Severity | Time | Status |
|---|-----------|----------|------|--------|
| 1 | JSON Schema → Zod bug | CRITICAL | 30min | ✅ Fixed |
| 2 | Header interpolation | MEDIUM | 15min | ✅ Fixed |
| 3 | Stale extension dist | HIGH | 5min | ✅ Fixed |
| 4 | Storage validation | MEDIUM | 10min | ✅ Fixed |

**Total Debug Time:** ~1 hour

---

## Common Patterns

### MCP stdio Transport Issues
- Remove ALL console.log statements
- Use proper MCP response format
- Test with simple inputs first

### VS Code Extension Build
- Always rebuild after source changes
- Use `npm run compile` or watch mode
- Verify dist/ matches src/

### Validation Strategy
- Use Zod for TypeScript type inference
- Use Ajv for JSON Schema validation at runtime
- Validate at all data boundaries
