# Spellbook: Key Decisions

This document tracks strategic decisions made during development.

---

## Decision 1: VS Code Extension Architecture

**Date:** November 27, 2025
**Decision:** Build Spellbook as a VS Code extension compatible with all forks

**Alternatives Considered:**
1. Web application with separate UI
2. CLI tool only
3. Standalone Electron app

**Reasoning:**
- VS Code extensions work across VS Code, Kiro, Cursor, Windsurf, and other forks
- Zero context switching - developers stay in their editor
- Native marketplace distribution
- Direct file system access for generating MCP tools
- Perfect fit for Kiroween hackathon (showcases Kiro integration)

**Outcome:** ✅ Successfully implemented command-based extension with progress feedback

---

## Decision 2: Monorepo Structure

**Date:** November 27, 2025
**Decision:** Use monorepo with packages/core and extensions/vscode

**Alternatives Considered:**
1. Single package with everything
2. Separate repositories
3. npm workspaces

**Reasoning:**
- Clear separation between core logic and VS Code-specific code
- Core package can be reused by MCP tool (meta-recursion!)
- Easier testing of core logic independently
- Standard pattern for VS Code extensions with shared libraries

**Outcome:** ✅ Clean architecture with @spellbook/core reused by both extension and MCP tool

---

## Decision 3: Ajv for JSON Schema Validation (Updated)

**Date:** November 27, 2025
**Decision:** Use Ajv for runtime JSON Schema validation in generated servers

**Original Decision:** Use Zod for validation
**Why Changed:** Zod schemas can't be constructed from JSON Schema at runtime. Embedding JSON Schema into `z.object()` caused `TypeError: keyValidator._parse is not a function`.

**Alternatives Considered:**
1. Zod (broken - can't accept JSON Schema)
2. Ajv (JSON Schema validator)
3. Custom validation code generation

**Reasoning:**
- Ajv is the standard JSON Schema validator
- Works directly with JSON Schema (no conversion needed)
- Excellent error messages with `allErrors: true`
- Widely used and battle-tested

**Outcome:** ✅ Generated servers now properly validate inputs using Ajv

---

## Decision 4: Meta-Recursion Feature

**Date:** November 27, 2025
**Decision:** Make Spellbook itself an MCP tool that can build MCP tools

**Alternatives Considered:**
1. VS Code extension only
2. Separate MCP tool
3. No MCP integration

**Reasoning:**
- Unique "wow factor" for hackathon judges
- Proves the concept works end-to-end
- Demonstrates deep MCP understanding
- Creates memorable demo moment

**Outcome:** ✅ Spellbook MCP tool with create_spell and list_spells commands

---

## Decision 5: Template Variable Interpolation

**Date:** November 27, 2025
**Decision:** Support `{{variable}}` syntax in URLs, headers, AND body

**Original Scope:** URL and body only
**Why Expanded:** Users need dynamic headers for auth tokens (e.g., `Authorization: Bearer {{token}}`)

**Reasoning:**
- Headers often contain API keys and tokens
- Consistent syntax across all HTTP config fields
- Enables real-world API integrations

**Outcome:** ✅ Full interpolation support with `checkNeedsInterpolation()` helper

---

## Decision 6: Property-Based Testing

**Date:** November 27, 2025
**Decision:** Use fast-check for property-based testing alongside unit tests

**Alternatives Considered:**
1. Unit tests only
2. Integration tests only
3. Manual testing

**Reasoning:**
- Property tests catch edge cases humans miss
- 100 random inputs per property = better coverage
- Complements unit tests for specific examples
- Validates correctness properties from design doc

**Outcome:** ✅ 71 tests (mix of property and unit tests) all passing


---

## Decision 7: Haunted Grimoire Sidebar

**Date:** November 28, 2025
**Decision:** Add embedded webview sidebar with haunted theme

**Alternatives Considered:**
1. Command palette only (QuickPick flow)
2. Full webview panel
3. Tree view with forms

**Reasoning:**
- Sidebar is always visible - better discoverability
- Webview allows rich UI with animations
- Haunted theme differentiates from other tools
- Live preview shows spell JSON as user types

**Outcome:** ✅ GrimoireSidebarProvider with floating particles, eerie glows, and tabbed interface

---

## Decision 8: Compiler Architecture Recognition

**Date:** November 28, 2025
**Decision:** Document Spellbook as a domain-specific compiler

**Discovery:**
During code review, realized the architecture naturally follows compiler design:
- Schema Layer = Lexer/Parser (Zod)
- Template Engine = IR Transforms (pure functions)
- Generator = Code Emission (file bundle)

**Impact:**
- Updated steering doc with compiler pipeline diagram
- Better mental model for future development
- Validates architecture is fundamentally sound

**Outcome:** ✅ Architecture documented in steering and README
