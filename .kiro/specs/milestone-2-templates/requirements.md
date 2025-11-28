# Requirements Document - Milestone 2: Templates

## Introduction

This milestone focuses on creating a template system that generates all necessary files for an MCP server from a Spell definition. The templates will produce Dockerfile, package.json, server code, and documentation that can be immediately built and deployed.

## Glossary

- **Template**: A function that takes a Spell and returns a string containing file content
- **MCP Server**: A Model Context Protocol server that exposes tools to Kiro
- **Spell**: A validated definition containing all information needed to generate an MCP tool
- **Template System**: The collection of template functions that generate all required files
- **Interpolation**: Replacing {{variable}} placeholders with actual values

## Requirements

### Requirement 1

**User Story:** As a developer, I want to generate a complete Dockerfile from a spell definition, so that the MCP server can be containerized and deployed

#### Acceptance Criteria

1. WHEN a spell is provided THEN the system SHALL generate a valid Dockerfile
2. WHEN the Dockerfile is built THEN the system SHALL produce a working Docker image
3. WHEN the Docker image runs THEN the system SHALL start the MCP server correctly
4. THE Dockerfile SHALL use Node.js 20 Alpine base image
5. THE Dockerfile SHALL install dependencies and copy source files

### Requirement 2

**User Story:** As a developer, I want to generate a package.json file from a spell definition, so that the MCP server has proper dependencies and metadata

#### Acceptance Criteria

1. WHEN a spell is provided THEN the system SHALL generate a valid package.json
2. THE package.json SHALL include @modelcontextprotocol/sdk as a dependency
3. THE package.json SHALL include zod as a dependency
4. THE package.json SHALL set type to "module" for ES modules
5. THE package.json SHALL include a name derived from the spell name
6. THE package.json SHALL include proper main entry point

### Requirement 3

**User Story:** As a developer, I want to generate MCP server code from a spell definition, so that the tool can handle requests from Kiro

#### Acceptance Criteria

1. WHEN a spell is provided THEN the system SHALL generate valid TypeScript/JavaScript server code
2. THE server code SHALL implement the MCP protocol using stdio transport
3. THE server code SHALL register the tool with correct name and description
4. THE server code SHALL validate input using the spell's input schema
5. WHEN the action type is HTTP THEN the system SHALL generate code that makes HTTP requests
6. WHEN the action type is script THEN the system SHALL generate code that executes the script
7. THE server code SHALL handle errors and return proper MCP error responses
8. THE server code SHALL support {{variable}} interpolation in HTTP URLs and bodies

### Requirement 4

**User Story:** As a developer, I want to generate a README file from a spell definition, so that users understand how to install and use the MCP tool

#### Acceptance Criteria

1. WHEN a spell is provided THEN the system SHALL generate a README.md file
2. THE README SHALL include the spell name as the title
3. THE README SHALL include the spell description
4. THE README SHALL include Docker build instructions
5. THE README SHALL include Kiro mcp.json configuration example
6. THE README SHALL document the input schema
7. THE README SHALL document the output schema

### Requirement 5

**User Story:** As a developer, I want all templates to be pure functions, so that they are testable and predictable

#### Acceptance Criteria

1. WHEN a template function is called with the same spell THEN the system SHALL return identical output
2. THE template functions SHALL not have side effects
3. THE template functions SHALL not depend on external state
4. THE template functions SHALL be synchronous

### Requirement 6

**User Story:** As a developer, I want templates to handle both HTTP and script actions correctly, so that all spell types can be generated

#### Acceptance Criteria

1. WHEN a spell has an HTTP action THEN the system SHALL generate fetch-based code
2. WHEN a spell has a script action THEN the system SHALL generate code execution logic
3. WHEN HTTP config includes headers THEN the system SHALL include them in the request
4. WHEN HTTP config includes a body THEN the system SHALL include it in the request
5. THE generated code SHALL handle both action types without errors

### Requirement 7

**User Story:** As a developer, I want template output to be syntactically valid, so that generated code can be used immediately without manual fixes

#### Acceptance Criteria

1. WHEN templates generate code THEN the system SHALL produce syntactically valid output
2. THE generated Dockerfile SHALL be valid Docker syntax
3. THE generated package.json SHALL be valid JSON
4. THE generated server code SHALL be valid JavaScript/TypeScript
5. THE generated README SHALL be valid Markdown
