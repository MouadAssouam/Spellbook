# Requirements Document

## Introduction

This milestone adds a visual Webview-based spell builder to the VS Code extension. The current command-based flow works but looks "dry" - this adds a polished Grimoire-themed UI that will impress hackathon judges and provide a better user experience.

## Glossary

- **Webview**: VS Code's embedded web browser panel for rich UI
- **Grimoire**: A book of magical spells - our design theme
- **Spell Form**: The visual form for creating MCP tools
- **Preview Panel**: Shows generated code before writing files

## Requirements

### Requirement 1: Grimoire Webview Panel

**User Story:** As a developer, I want a visual spell builder interface, so that I can create MCP tools with a polished, intuitive UI instead of multiple dialog boxes.

#### Acceptance Criteria

1. WHEN a user runs "Spellbook: Open Grimoire" command, THE extension SHALL open a Webview panel with the spell builder form
2. WHEN the Webview opens, THE extension SHALL display a dark-themed UI with gold accents matching the grimoire aesthetic
3. WHEN the user views the panel, THE extension SHALL show form fields for name, description, action type, and configuration
4. WHEN the user switches action types, THE extension SHALL dynamically show HTTP or Script configuration fields

### Requirement 2: Real-Time Validation

**User Story:** As a developer, I want instant feedback on my inputs, so that I can fix errors before attempting to generate.

#### Acceptance Criteria

1. WHILE the user types in the name field, THE extension SHALL validate kebab-case format and show inline errors
2. WHILE the user types in the description field, THE extension SHALL show character count and validate length (100-500)
3. WHEN validation fails, THE extension SHALL highlight the field in red with an error message
4. WHEN all fields are valid, THE extension SHALL enable the "Summon Spell" button

### Requirement 3: Code Preview

**User Story:** As a developer, I want to preview generated code before creating files, so that I can verify the output matches my expectations.

#### Acceptance Criteria

1. WHEN the user clicks "Preview", THE extension SHALL show generated code in a tabbed preview area
2. WHEN previewing, THE extension SHALL display tabs for Dockerfile, package.json, index.js, and README.md
3. WHEN the user views preview tabs, THE extension SHALL syntax-highlight the code appropriately

### Requirement 4: Spell Generation from Webview

**User Story:** As a developer, I want to generate my spell directly from the webview, so that I have a seamless experience.

#### Acceptance Criteria

1. WHEN the user clicks "Summon Spell" with valid inputs, THE extension SHALL generate all MCP server files
2. WHILE generating, THE extension SHALL show a loading spinner in the webview
3. WHEN generation completes, THE extension SHALL show a success message with quick action buttons
4. WHEN generation fails, THE extension SHALL show the error message in the webview

### Requirement 5: Example Spell Loading

**User Story:** As a developer, I want to load example spells into the form, so that I can quickly start from a working template.

#### Acceptance Criteria

1. WHEN the webview loads, THE extension SHALL show example spell buttons (GitHub Fetcher, Weather API, Calculator)
2. WHEN the user clicks an example button, THE extension SHALL populate all form fields with that example's values
3. WHEN an example is loaded, THE extension SHALL allow the user to modify any field before generating
