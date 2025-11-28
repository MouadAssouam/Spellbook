# Spellbook: Key Learnings

This document captures insights gained during development.

---

## About MCP (Model Context Protocol)

1. **stdio transport is fragile** - No console.log allowed, breaks protocol
2. **JSON Schema is the standard** - Use it for tool input/output definitions
3. **Ajv > Zod for runtime validation** - Can't convert JSON Schema to Zod at runtime
4. **Tools need clear descriptions** - LLMs use them to decide when to call tools
5. **MCP tools are composable** - Spellbook creates tools that create tools!

---

## About Kiro

1. **Specs drive development** - Requirements → Design → Tasks workflow is powerful
2. **Steering ensures consistency** - spell-architect.md kept code style uniform
3. **Property-based testing catches bugs** - 71 tests with fast-check found edge cases
4. **Context is king** - #File and #Folder references accelerate coding
5. **Hooks automate workflows** - test-on-save, build-on-change, lint-spell-names

---

## About VS Code Extensions

1. **Commands are entry points** - Register in package.json contributes
2. **QuickPick for selection** - Better UX than input boxes for choices
3. **Progress API is powerful** - withProgress() with cancellation support
4. **Rebuild dist after changes** - Easy to forget, causes stale code bugs

---

## About TypeScript

1. **Strict mode is worth it** - Catches bugs at compile time
2. **Zod for type inference** - Single source of truth for types
3. **ES modules everywhere** - Use type: "module" in package.json
4. **Discriminated unions rock** - Action = { type: 'http' } | { type: 'script' }

---

## About Code Generation

1. **It's actually a compiler** - Schema → Templates → Generator = Lexer → IR → Emitter
2. **Templates should be pure functions** - Same input → same output (determinism)
3. **Interpolation needs escaping** - Handle special characters in strings
4. **Validate before generate** - Catch errors early with clear messages
5. **Test generated code** - String checks aren't enough, run it!
6. **Two-layer validation** - Zod at build-time, Ajv at runtime

---

## Critical Bug Patterns Found

| Bug | Root Cause | Fix |
|-----|------------|-----|
| `_parse is not a function` | JSON Schema in z.object() | Use Ajv instead |
| Headers not interpolated | Only checked URL/body | Check headers too |
| Stale extension | Forgot to rebuild | npm run compile |
| Invalid spells loaded | No validation on load | SpellSchema.safeParse() |

---

## What Worked Well

1. **Spec-driven development** - Clear requirements prevented scope creep
2. **Property-based testing** - Found edge cases humans miss
3. **Monorepo structure** - Clean separation, easy reuse
4. **Grimoire theme** - Made the project memorable and fun

---

## What We'd Do Differently

1. **Add integration tests earlier** - Would have caught the Ajv bug sooner
2. **Use watch mode** - Avoid stale dist issues
3. **Test generated servers** - Actually run them, not just check strings
4. **Document secrets handling** - Users need to know about plaintext storage

---

## Time Saved by Kiro

| Feature | Manual Estimate | With Kiro | Savings |
|---------|-----------------|-----------|---------|
| Spec writing | 4h | 30min | 87% |
| Type definitions | 3h | 30min | 83% |
| Templates | 6h | 1h | 83% |
| Generator | 4h | 45min | 81% |
| VS Code extension | 8h | 2h | 75% |
| MCP integration | 4h | 1h | 75% |
| Testing (71 tests) | 6h | 1.5h | 75% |
| Documentation | 4h | 1h | 75% |
| Bug fixes | 2h | 1h | 50% |
| **TOTAL** | **41h** | **9.25h** | **77%** |

---

## Favorite Kiro Moments

1. **"The Meta Moment"** - Spellbook creating itself as an MCP tool
2. **Property tests passing** - 71 green checkmarks after bug fixes
3. **Grimoire theme** - "Summon Server" instead of "Generate"
4. **Spec workflow** - Requirements → Design → Tasks just works
