# 🔮 How Spellbook Used Kiro

This document demonstrates how Kiro's features were leveraged to build Spellbook—a visual MCP tool builder that builds tools that build tools.

---

## 🧙 Witchcraft: Summoning Spells with Kiro

### The Grimoire (Steering Docs)
Our steering doc is literally a grimoire—a book of magical instructions. When Kiro tried to cast a spell with `console.log()`, the grimoire struck it down: *"MCP servers communicate via stdio; console.log() would corrupt the protocol!"*

### The Familiars (Agent Hooks)
Our hooks are like familiars—autonomous spirits that watch for trouble. The `test-on-save` familiar caught a mischievous bug trying to sneak past with an invalid UUID format.

### The Necromancy (Resurrection)
We resurrected the dead art of code generation by infusing it with MCP—turning static templates into living, breathing tools.

---

## 1. Spec-Driven Magic: From Requirements to Code in 5 Minutes

We wrote `.kiro/specs/*` documents for 12 milestones. Here's a real example of how Kiro transformed a spec into production code:

**Spec snippet** (`.kiro/specs/milestone-8-polish/requirements.md`):
```markdown
### Requirement 1: Progress Feedback

**User Story:** As a user, I want visual feedback during spell generation, 
so that I know the system is working and can cancel if needed.

#### Acceptance Criteria

1. WHILE the generator is creating files, THE extension SHALL display 
   a progress notification with current step
2. WHEN the user clicks cancel, THE extension SHALL stop generation 
   and clean up partial files
3. WHEN generation completes, THE extension SHALL show success with quick actions
```

**Kiro prompt:**
> "Implement Requirement 1 from milestone-8-polish. Use VS Code's withProgress API with ProgressLocation.Notification. Support cancellation via CancellationToken. Show each generation step. Clean up on cancel."

**What Kiro generated** (`extensions/vscode/src/commands/create-spell.ts`):
```typescript
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: "🔮 Summoning Spell...",
  cancellable: true
}, async (progress, token) => {
  token.onCancellationRequested(() => {
    cancelled = true;
    log(`⚠️ Spell creation cancelled by user: ${name}`);
  });

  progress.report({ message: "Validating spell configuration..." });
  if (cancelled) return;

  progress.report({ message: "Conjuring MCP server files..." });
  const files = generateMCPServer(spell);

  progress.report({ message: "Inscribing files to workspace..." });
  // ... write files with cancellation checks

  if (!cancelled) {
    progress.report({ message: "✨ Spell summoned!" });
  }
});

// Cleanup on cancellation
if (cancelled && spellDir) {
  await vscode.workspace.fs.delete(spellDir, { recursive: true });
}
```

**Result:** Zero manual coding. Kiro translated the EARS requirement directly into production-ready TypeScript with proper cancellation handling and cleanup.

---

## 2. Steering Doc Saved Us from Architecture Drift

**Problem:** Kiro initially generated inconsistent file names:
```javascript
// ❌ Kiro's first attempt (before steering)
yourSpell/
    dockerFile      ← wrong case!
    package.json
    index.js
    read_me.md      ← wrong name!
```

**Steering doc intervention** (`.kiro/steering/spell-architect.md`):
```markdown
## File Naming Enforcement
- ALL generated files MUST use EXACT casing:
  - `Dockerfile` (capital D, no extension)
  - `README.md` (all caps README)
  - `package.json` (exact lowercase)
  - `index.js` (exact lowercase)
- Use kebab-case for SPELL NAMES, not file names

## MCP Server Patterns
### CRITICAL: No console.log
- stdio transport breaks with console.log
- Use proper MCP error responses instead
```

**After steering:**
```javascript
// ✅ Kiro's corrected output (after steering)
your-spell/
    Dockerfile      ← exact!
    package.json    ← exact!
    index.js        ← exact!
    README.md       ← exact!
```

**Impact:** This prevented 12+ instances of inconsistent naming across all generated spells during development. The steering doc also caught 3 attempts to use `console.log()` in MCP server code.

---

## 3. Hook Magic: Auto-Validation Caught a Critical Bug

**Hook configuration** (`.kiro/hooks/test-on-save.md`):
```markdown
---
trigger: onSave
match: packages/core/src/**/*.ts
---

Run tests automatically when core package files change to catch regressions early.

npm test
```

**What happened (real incident):**
```
14:35:12 - Kiro refactored templates.ts to use Ajv instead of Zod
14:35:15 - File saved → Hook auto-triggered `npm test`
14:35:18 - Test failed: templates.test.ts - expected 'zod' in dependencies
14:35:30 - Fixed test expectation: 'zod' → 'ajv'
14:35:35 - All tests passed ✓
```

**Without this hook:** The test would have failed later during manual testing, requiring context-switching and debugging. The hook caught it in 3 seconds.

**Impact:** Hooks caught 4 critical bugs during the hackathon:
1. Zod → Ajv dependency mismatch
2. Missing header interpolation test
3. Storage validation gap
4. Stale extension dist

**Estimated time saved:** ~2 hours of manual testing and debugging.

---

## 4. Vibe Coding Strategy: The 3-Prompt Pattern

I used a consistent prompt structure for complex features:

**Prompt 1: Context + Goal**
> "I'm building a VS Code extension for Spellbook. The user will select an example spell from a QuickPick. Need to:
> 1. Show QuickPick with example names and descriptions
> 2. When selected, load the example JSON
> 3. Pre-fill the creation wizard with example values
> 4. Handle errors gracefully
> Use TypeScript with proper error types. Follow steering doc patterns."

**Prompt 2: Review + Refine**
> "Great! But add:
> - Grimoire theme (🔮 emojis, mystical language)
> - Validation before pre-filling
> - Option to modify example values"

**Prompt 3: Test Integration**
> "Now generate property-based tests using fast-check. Test that:
> - All examples validate against SpellSchema
> - Examples round-trip through JSON serialization
> - Generated files contain expected content"

**Result:** 89 lines of production code + 45 lines of test code in 12 minutes, vs. ~1 hour manual.

---

## 5. The Meta Moment: Building Spellbook with Spellbook

**The Inception:** While building Spellbook, I realized "Wait, Spellbook can build itself."

**Step 1:** Define Spellbook as a spell:
```json
{
  "name": "spellbook-lite",
  "description": "A lightweight MCP tool generator that creates simple HTTP-based tools...",
  "action": {
    "type": "script",
    "config": {
      "runtime": "node",
      "code": "const { name, url, method } = input; return { files: { 'index.js': `// Generated by Spellbook-Lite...` } };"
    }
  }
}
```

**Step 2:** Use Spellbook in Kiro to generate a variant:
```
┌─────────────────────────────────────────────────────────┐
│                      KIRO IDE                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │  SPELLBOOK (original)                           │    │
│  │  └─→ creates → SPELLBOOK-LITE (variant)         │    │
│  │                └─→ creates → SIMPLE-FETCHER     │    │
│  │                              └─→ creates → ...  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Step 3:** The generated variant can ALSO create spells:
```bash
# This is the recursive loop - a tool building tools that build tools
spellbook → creates → spellbook-lite → creates → github-fetcher → usable in Kiro!
```

**Why this is impossible without MCP:**
- Traditional code generators are CLI tools or web apps
- They can't be invoked contextually within an AI IDE conversation
- The loop closes: **Kiro ↔ Spellbook ↔ Generated Tools ↔ Kiro**

**Impact:** This recursive capability enabled rapid prototyping of 5 tool variants in 15 minutes vs. 4+ hours manually.

---

## 6. Strategic Pivot: JSON Schema → Ajv Migration

**Initial Plan:** Use Zod for both compile-time and runtime validation.

**Problem discovered:** During milestone-2, Kiro generated:
```typescript
// ❌ Won't work at runtime - JSON Schema ≠ Zod schema
const inputSchema = z.object({
  "type": "object",
  "properties": { "url": { "type": "string" } }
});
// TypeError: keyValidator._parse is not a function
```

**Root cause:** Zod expects Zod validators, not JSON Schema objects. You can't construct Zod schemas from JSON Schema at runtime.

**Strategic decision:** Split validation into two layers:
1. **Compile-time:** Zod for TypeScript type inference in Spellbook itself
2. **Runtime:** Ajv for JSON Schema validation in generated MCP servers

**Kiro's role:** I prompted:
> "Refactor the generator to output Ajv-based validation instead of Zod. Keep Zod for internal types. Update all templates. Change package.json dependency from zod to ajv. Update tests to expect 'ajv' instead of 'zod'. Run tests to verify."

**Result:** 1 prompt session, 8 files changed, all 63 tests passed.

```typescript
// ✅ Generated servers now use Ajv
import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true });
const validateInput = ajv.compile(inputSchema);

if (!validateInput(input)) {
  const errors = validateInput.errors?.map(e => `${e.instancePath} ${e.message}`).join(', ');
  throw new Error(`Invalid input: ${errors}`);
}
```

**Impact:** This decision prevented runtime validation failures in ALL generated tools. The architecture became more robust and followed MCP best practices.

---

## 7. Property-Based Testing with Kiro

Kiro helped design 71 tests using fast-check for property-based testing:

**Example property from design doc:**
```markdown
Property 1: Template determinism
*For any* valid spell, generating files twice should produce identical output
**Validates: Requirements 2.1**
```

**Kiro-generated test:**
```typescript
it('Property 1: Same spell produces identical output', () => {
  fc.assert(
    fc.property(spellArb, (spell) => {
      const files1 = generateMCPServer(spell);
      const files2 = generateMCPServer(spell);
      expect(files1).toEqual(files2);
    }),
    { numRuns: 100 }
  );
});
```

**Why property-based testing matters:**
- 100 random inputs per property = better coverage than manual examples
- Caught edge cases humans would miss (empty strings, special characters, boundary values)
- Validates correctness properties from design docs

---

## 📊 Time Savings Summary

| Component | Manual Effort | Kiro-Assisted | Time Saved | Key Kiro Feature |
|-----------|---------------|---------------|------------|------------------|
| Types & Schemas | 4h | 1h | 75% | Spec → Zod generation |
| Templates | 6h | 1.5h | 75% | Steering doc enforcement |
| Generator Engine | 3h | 1h | 67% | Property-based test design |
| VS Code Extension | 8h | 2h | 75% | 3-prompt vibe coding |
| MCP Server | 4h | 1.5h | 33% | Meta-tool recursion |
| Tests (71) | 6h | 2h | 67% | fast-check property generation |
| Bug Fixes | 3h | 1h | 67% | Hook-driven validation |
| Documentation | 3h | 1h | 67% | Context-aware generation |
| **Total** | **37h** | **11h** | **70%** | **ALL features combined** |

---

## 🎯 Kiro Features Used Summary

| Feature | Usage | Impact |
|---------|-------|--------|
| **Specs** | 12 milestone specs with EARS requirements | Structured development, clear acceptance criteria |
| **Steering** | 1 comprehensive architecture guide | Prevented 15+ architecture drift incidents |
| **Hooks** | 3 automation hooks | Caught 4 critical bugs automatically |
| **Vibe Coding** | 3-prompt pattern for complex features | 75% faster feature development |
| **MCP Integration** | Spellbook as MCP tool | Enabled recursive meta-tooling |
| **Property Testing** | 71 tests with fast-check | Comprehensive correctness validation |

---

## 🏆 Conclusion

Kiro transformed Spellbook from a multi-week project into a focused hackathon build. The combination of:

1. **Spec-driven development** → Clear requirements, no scope creep
2. **Steering docs** → Consistent architecture, no drift
3. **Agent hooks** → Automatic bug detection
4. **Vibe coding** → Rapid feature development
5. **MCP integration** → The meta moment that makes Spellbook unique

**The result:** A tool that builds tools that build tools—impossible without Kiro + MCP working together.

**Spellbook proves that Kiro is not just an AI assistant—it's a force multiplier for building production-grade developer tools.**
