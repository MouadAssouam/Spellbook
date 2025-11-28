# Requirements Document

## Introduction

Milestone 7 implements the Spellbook MCP Tool - the "meta moment" where Spellbook becomes an MCP tool that can create other MCP tools. This is the key differentiator that makes Spellbook unique: a tool that builds tools, including itself. The MCP tool exposes two capabilities: creating new spells and listing existing spells, with persistent storage to ensure spells survive restarts.

## Glossary

- **MCP Tool**: A Model Context Protocol server that exposes tools to AI assistants like Kiro
- **Spellbook MCP**: The MCP server that provides spell creation and listing capabilities
- **create_spell**: Tool that generates MCP server files from a spell definition
- **list_spells**: Tool that lists all previously created spells
- **Persistent Storage**: File-based storage that survives process restarts
- **stdio Transport**: Standard input/output communication protocol for MCP servers

## Requirements

### Requirement 1

**User Story:** As a Kiro user, I want to create MCP tools using natural language, so that I can build tools without leaving my IDE.

#### Acceptance Criteria

1. WHEN a user invokes create_spell with valid spell parameters THEN the System SHALL generate four MCP server files (Dockerfile, package.json, index.js, README.md)
2. WHEN a user invokes create_spell THEN the System SHALL validate the spell against SpellSchema before generation
3. WHEN a user invokes create_spell with invalid parameters THEN the System SHALL return a clear error message
4. WHEN a spell is created THEN the System SHALL persist the spell to .kiro/data/spells.json

### Requirement 2

**User Story:** As a Kiro user, I want to list my created spells, so that I can see what tools I've built.

#### Acceptance Criteria

1. WHEN a user invokes list_spells THEN the System SHALL return all previously created spells
2. WHEN no spells exist THEN the System SHALL return a helpful message indicating no spells are available
3. WHEN the MCP server restarts THEN the System SHALL load spells from persistent storage

### Requirement 3

**User Story:** As a developer, I want the MCP server to use stdio transport, so that it integrates with Kiro's MCP infrastructure.

#### Acceptance Criteria

1. WHEN the MCP server starts THEN the System SHALL use StdioServerTransport for communication
2. WHEN the MCP server is queried for tools THEN the System SHALL return create_spell and list_spells tool definitions
3. THE System SHALL NOT use console.log to avoid breaking stdio protocol

### Requirement 4

**User Story:** As a developer, I want spells to persist across restarts, so that my work is not lost.

#### Acceptance Criteria

1. WHEN a spell is created THEN the System SHALL save it to .kiro/data/spells.json
2. WHEN the storage directory does not exist THEN the System SHALL create it automatically
3. WHEN the MCP server starts THEN the System SHALL load existing spells from storage
4. WHEN the storage file is corrupted THEN the System SHALL handle the error gracefully and start with empty storage
