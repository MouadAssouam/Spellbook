# Requirements Document - Milestone 4: VS Code Extension

## Introduction

This milestone focuses on creating a VS Code extension that provides a simple command to generate MCP servers from spell definitions. The extension will use the generator we built and save files directly to the workspace.

## Glossary

- **VS Code Extension**: A plugin that extends Visual Studio Code functionality
- **Command**: A user-invokable action in VS Code (via command palette or menu)
- **Workspace**: The currently open folder in VS Code
- **Extension Activation**: When the extension loads and becomes available

## Requirements

### Requirement 1

**User Story:** As a developer, I want to invoke a command to create an MCP server, so that I can quickly generate tools

#### Acceptance Criteria

1. WHEN the extension is installed THEN the system SHALL register a "Create MCP Server" command
2. WHEN the command is invoked THEN the system SHALL prompt for spell details
3. THE command SHALL be accessible from the command palette
4. THE extension SHALL activate when the command is invoked

### Requirement 2

**User Story:** As a developer, I want to provide spell details through prompts, so that I can create a server without writing JSON

#### Acceptance Criteria

1. WHEN the command runs THEN the system SHALL prompt for spell name
2. WHEN the command runs THEN the system SHALL prompt for spell description
3. WHEN the command runs THEN the system SHALL prompt for action type (HTTP or Script)
4. WHEN action type is HTTP THEN the system SHALL prompt for URL and method
5. WHEN action type is Script THEN the system SHALL prompt for code
6. THE prompts SHALL validate input before proceeding

### Requirement 3

**User Story:** As a developer, I want generated files saved to my workspace, so that I can immediately use them

#### Acceptance Criteria

1. WHEN generation succeeds THEN the system SHALL create a directory named after the spell
2. THE directory SHALL be created in the workspace root
3. THE system SHALL write all 4 files (Dockerfile, package.json, index.js, README.md)
4. WHEN files are written THEN the system SHALL show a success notification
5. THE system SHALL open the README.md file after generation

### Requirement 4

**User Story:** As a developer, I want clear error messages, so that I can fix problems quickly

#### Acceptance Criteria

1. WHEN validation fails THEN the system SHALL show an error notification
2. WHEN no workspace is open THEN the system SHALL show an error message
3. WHEN file writing fails THEN the system SHALL show an error with details
4. THE error messages SHALL be user-friendly

### Requirement 5

**User Story:** As a developer, I want the extension to be lightweight, so that it doesn't slow down VS Code

#### Acceptance Criteria

1. THE extension SHALL only activate when the command is invoked
2. THE extension SHALL not run background processes
3. THE extension SHALL not consume significant memory when idle
4. THE extension SHALL complete generation in under 1 second
