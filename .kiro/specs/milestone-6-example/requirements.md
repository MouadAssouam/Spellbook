# Requirements Document

## Introduction

Milestone 6 validates the Spellbook system by testing with real example spells. This milestone ensures that the generator produces working MCP servers that can be built and executed. The three example spells (GitHub Fetcher, Weather API, Calculator) cover both HTTP and Script action types, providing comprehensive validation of the entire generation pipeline.

## Glossary

- **Spell**: A configuration object that defines an MCP tool's behavior, inputs, and outputs
- **MCP Server**: A Model Context Protocol server that exposes tools to AI assistants
- **Generator**: The system that transforms Spell definitions into deployable MCP server files
- **Example Spell**: Pre-defined spell configurations used for testing and demonstration
- **HTTP Action**: A spell action that makes HTTP requests to external APIs
- **Script Action**: A spell action that executes JavaScript code locally

## Requirements

### Requirement 1

**User Story:** As a developer, I want to generate MCP servers from example spells, so that I can verify the generator produces valid output.

#### Acceptance Criteria

1. WHEN the generator receives the GitHub Fetcher example spell THEN the System SHALL produce four valid files (Dockerfile, package.json, index.js, README.md)
2. WHEN the generator receives the Weather API example spell THEN the System SHALL produce four valid files with URL interpolation support
3. WHEN the generator receives the Calculator example spell THEN the System SHALL produce four valid files with script execution code
4. WHEN any example spell is processed THEN the System SHALL validate the spell against SpellSchema before generation

### Requirement 2

**User Story:** As a developer, I want generated package.json files to be valid JSON, so that npm can install dependencies.

#### Acceptance Criteria

1. WHEN a package.json is generated THEN the System SHALL produce valid JSON that can be parsed
2. WHEN a package.json is generated THEN the System SHALL include @modelcontextprotocol/sdk dependency
3. WHEN a package.json is generated THEN the System SHALL include zod dependency
4. WHEN a package.json is generated THEN the System SHALL set type to "module"

### Requirement 3

**User Story:** As a developer, I want generated Dockerfiles to follow best practices, so that containers build successfully.

#### Acceptance Criteria

1. WHEN a Dockerfile is generated THEN the System SHALL use node:20-alpine as base image
2. WHEN a Dockerfile is generated THEN the System SHALL include WORKDIR directive
3. WHEN a Dockerfile is generated THEN the System SHALL copy package files before npm install
4. WHEN a Dockerfile is generated THEN the System SHALL use npm ci for reproducible builds

### Requirement 4

**User Story:** As a developer, I want generated server code to be syntactically valid JavaScript, so that Node.js can execute it.

#### Acceptance Criteria

1. WHEN server code is generated THEN the System SHALL produce syntactically valid JavaScript
2. WHEN server code is generated for HTTP actions THEN the System SHALL include fetch implementation
3. WHEN server code is generated for Script actions THEN the System SHALL include Function constructor execution
4. WHEN server code includes URL placeholders THEN the System SHALL include interpolation function

### Requirement 5

**User Story:** As a developer, I want generated README files to document the MCP tool, so that users understand how to use it.

#### Acceptance Criteria

1. WHEN a README is generated THEN the System SHALL include the spell name as title
2. WHEN a README is generated THEN the System SHALL include the spell description
3. WHEN a README is generated THEN the System SHALL include Docker build instructions
4. WHEN a README is generated THEN the System SHALL include mcp.json configuration example
5. WHEN a README is generated THEN the System SHALL include input and output schema documentation

### Requirement 6

**User Story:** As a developer, I want to save example spells as JSON files, so that they can be shared and reused.

#### Acceptance Criteria

1. WHEN an example spell is exported THEN the System SHALL produce valid JSON
2. WHEN example JSON files are created THEN the System SHALL place them in the examples/ directory
3. WHEN example JSON files are loaded THEN the System SHALL validate them against SpellSchema
