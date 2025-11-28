# Requirements Document

## Introduction

This milestone defines the core data models and validation schemas for Spellbook. These types form the foundation for spell definitions, which are used to generate MCP tools. All types use Zod for runtime validation with TypeScript type inference.

## Glossary

- **Spell**: A complete definition for generating an MCP tool, including name, description, schemas, and action
- **Action**: The behavior a spell performs - either an HTTP request or script execution
- **HTTPConfig**: Configuration for HTTP-based actions (URL, method, headers, body)
- **ScriptConfig**: Configuration for script-based actions (runtime, code)
- **Zod**: Runtime validation library that infers TypeScript types from schemas

## Requirements

### Requirement 1

**User Story:** As a developer, I want type-safe spell definitions, so that invalid data is caught at compile time and runtime.

#### Acceptance Criteria

1. WHEN a Spell is defined THEN the System SHALL require id (UUID), name (3-50 chars, kebab-case), description (100-500 chars), inputSchema, outputSchema, and action fields
2. WHEN a spell name is validated THEN the System SHALL accept only alphanumeric characters and hyphens matching pattern `^[a-zA-Z0-9-]+$`
3. WHEN a spell description is validated THEN the System SHALL require between 100 and 500 characters
4. WHEN types are exported THEN the System SHALL provide both Zod schemas and inferred TypeScript types

### Requirement 2

**User Story:** As a developer, I want to define HTTP-based actions, so that spells can make API calls.

#### Acceptance Criteria

1. WHEN an HTTP action is defined THEN the System SHALL require url (valid URL format) and method (GET, POST, PUT, PATCH, DELETE)
2. WHEN an HTTP action is defined THEN the System SHALL optionally accept headers (string key-value pairs) and body (string template)
3. WHEN a URL contains template variables THEN the System SHALL accept `{{variableName}}` syntax for interpolation

### Requirement 3

**User Story:** As a developer, I want to define script-based actions, so that spells can execute custom JavaScript logic.

#### Acceptance Criteria

1. WHEN a script action is defined THEN the System SHALL require runtime (currently only 'node') and code (non-empty string)
2. WHEN a script action is validated THEN the System SHALL ensure code is at least 1 character

### Requirement 4

**User Story:** As a developer, I want clear validation error messages, so that I can fix invalid spell definitions quickly.

#### Acceptance Criteria

1. WHEN validation fails THEN the System SHALL return detailed error messages with field paths
2. WHEN multiple fields are invalid THEN the System SHALL return all validation errors, not just the first one
3. WHEN using safeParse THEN the System SHALL return a discriminated union with success boolean and either data or error
