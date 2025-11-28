# Requirements Document - Milestone 3: Generator

## Introduction

This milestone focuses on creating the generator engine that combines types and templates into a complete MCP server generation system. The generator validates spell definitions and produces all necessary files ready for deployment.

## Glossary

- **Generator**: The main function that orchestrates spell validation and file generation
- **MCP Server Files**: The complete set of files needed to run an MCP server (Dockerfile, package.json, server code, README)
- **File Bundle**: A collection of generated files as key-value pairs (filename → content)
- **Spell Validation**: The process of ensuring a spell definition meets all requirements before generation

## Requirements

### Requirement 1

**User Story:** As a developer, I want to generate a complete MCP server from a spell definition, so that I can deploy the tool immediately

#### Acceptance Criteria

1. WHEN a valid spell is provided THEN the system SHALL generate all required files
2. THE system SHALL generate a Dockerfile
3. THE system SHALL generate a package.json
4. THE system SHALL generate server code (index.js)
5. THE system SHALL generate a README.md
6. THE generated files SHALL be returned as a Record<string, string>

### Requirement 2

**User Story:** As a developer, I want spell definitions to be validated before generation, so that invalid spells are rejected early

#### Acceptance Criteria

1. WHEN an invalid spell is provided THEN the system SHALL throw a validation error
2. THE validation error SHALL include details about which fields are invalid
3. WHEN a valid spell is provided THEN the system SHALL proceed with generation
4. THE system SHALL use Zod schema validation

### Requirement 3

**User Story:** As a developer, I want the generator to be a pure function, so that it is testable and predictable

#### Acceptance Criteria

1. WHEN the generator is called with the same spell THEN the system SHALL return identical output
2. THE generator SHALL not have side effects
3. THE generator SHALL not depend on external state
4. THE generator SHALL be synchronous

### Requirement 4

**User Story:** As a developer, I want to export generated files, so that I can use them in different contexts

#### Acceptance Criteria

1. THE system SHALL provide a function to export files as a Record<string, string>
2. THE Record keys SHALL be filenames
3. THE Record values SHALL be file contents as strings
4. THE function SHALL be exported from the core package

### Requirement 5

**User Story:** As a developer, I want comprehensive error messages, so that I can fix invalid spell definitions

#### Acceptance Criteria

1. WHEN validation fails THEN the system SHALL provide clear error messages
2. THE error messages SHALL indicate which field failed validation
3. THE error messages SHALL explain why validation failed
4. THE error messages SHALL be user-friendly

### Requirement 6

**User Story:** As a developer, I want the generator to work with all spell types, so that both HTTP and script actions are supported

#### Acceptance Criteria

1. WHEN a spell has an HTTP action THEN the system SHALL generate appropriate server code
2. WHEN a spell has a script action THEN the system SHALL generate appropriate server code
3. THE generated code SHALL handle both action types correctly
4. THE system SHALL not fail for either action type
