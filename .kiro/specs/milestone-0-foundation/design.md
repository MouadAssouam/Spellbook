# Design Document

## Overview

This design establishes the foundation for Spellbook - a VS Code extension that visually builds MCP tools. The foundation includes the monorepo structure, TypeScript configuration, dependency management, and documentation infrastructure required for the Kiroween hackathon.

## Architecture

Spellbook follows a monorepo architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    SPELLBOOK MONOREPO                    │
├─────────────────────────────────────────────────────────┤
│  packages/core/                                          │
│  - Types & Zod schemas                                   │
│  - Template engine                                       │
│  - MCP server generator                                  │
│  - Spellbook MCP tool (meta!)                            │
├─────────────────────────────────────────────────────────┤
│  extensions/vscode/                                      │
│  - VS Code extension entry point                         │
│  - Sidebar webview UI                                    │
│  - Command palette integration                           │
│  - File system operations                                │
├─────────────────────────────────────────────────────────┤
│  .kiro/                                                  │
│  - specs/ (milestone specifications)                     │
│  - steering/ (code style guides)                         │
│  - hooks/ (automated workflows)                          │
│  - conversations/ (Kiro chat logs)                       │
│  - data/ (persistent storage)                            │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Directory Structure

```
spellbook/
├── .kiro/
│   ├── specs/
│   │   ├── milestone-0-foundation/
│   │   ├── milestone-1-types/
│   │   └── ... (milestone-2 through milestone-10)
│   ├── steering/
│   │   └── spell-architect.md
│   ├── hooks/
│   ├── conversations/
│   ├── data/
│   ├── timesheet.md
│   ├── DECISIONS.md
│   ├── CHALLENGES.md
│   └── LEARNINGS.md
├── packages/
│   └── core/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── extensions/
│   └── vscode/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── examples/
├── scripts/
│   └── generate-metrics.js
├── package.json
├── tsconfig.json
├── .gitignore
├── LICENSE
└── README.md
```

## Data Models

No data models in this milestone. Defined in Milestone 1.

## Correctness Properties

*Properties bridge human-readable specs and machine-verifiable guarantees.*

### Property 1: Directory structure completeness
*For any* initialized project, all required directories SHALL exist
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: TypeScript compilation success
*For any* valid config, `tsc --noEmit` SHALL complete without errors
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Dependency availability
*For any* installed project, all packages SHALL be resolvable
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Error Handling

- Directory creation failure: report path and error
- npm install failure: report failing package
- TypeScript config invalid: report specific error

## Testing Strategy

### Unit Tests
- Verify directory structure creation
- Verify package.json validity
- Verify tsconfig.json validity

### Property-Based Tests
Not applicable for foundation milestone. Introduced in Milestone 1.

### Integration Tests
- `npm install` resolves all dependencies
- `tsc --noEmit` compiles successfully
- `npm test` framework works
