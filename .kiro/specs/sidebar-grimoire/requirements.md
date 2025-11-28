# Requirements Document

## Introduction

This feature moves the Grimoire spell builder UI from a separate webview panel into the VS Code sidebar. Users will be able to create MCP tools directly within the sidebar without opening a separate panel, providing a more integrated and streamlined experience.

## Glossary

- **Grimoire**: The visual spell builder interface for creating MCP tools
- **Sidebar**: The VS Code Activity Bar panel area (left side of the editor)
- **WebviewView**: A VS Code API that allows embedding webview content in sidebar views
- **Spell**: An MCP tool definition that generates a containerized server

## Requirements

### Requirement 1

**User Story:** As a developer, I want to see the Grimoire form directly in the sidebar, so that I can create spells without opening a separate panel.

#### Acceptance Criteria

1. WHEN a user clicks the Spellbook sidebar icon THEN the Sidebar SHALL display the Grimoire spell builder form
2. WHEN the sidebar is opened THEN the Sidebar SHALL show the spell name input, description textarea, and action type selector
3. WHEN the user interacts with the form THEN the Sidebar SHALL provide real-time validation feedback
4. WHEN the sidebar is collapsed and reopened THEN the Sidebar SHALL preserve the form state

### Requirement 2

**User Story:** As a developer, I want the sidebar form to be compact and scrollable, so that it fits well in the narrow sidebar space.

#### Acceptance Criteria

1. WHEN the form is displayed THEN the Sidebar SHALL use a compact layout optimized for narrow widths
2. WHEN the form content exceeds the visible area THEN the Sidebar SHALL enable vertical scrolling
3. WHEN form sections are collapsed THEN the Sidebar SHALL reduce vertical space usage
4. WHEN the sidebar is resized THEN the Sidebar SHALL adapt the form layout responsively

### Requirement 3

**User Story:** As a developer, I want to switch between viewing my spells and creating new ones, so that I can manage my workflow efficiently.

#### Acceptance Criteria

1. WHEN the sidebar loads THEN the Sidebar SHALL display a tabbed interface with "My Spells" and "Create Spell" tabs
2. WHEN a user clicks the "My Spells" tab THEN the Sidebar SHALL show the list of existing spells
3. WHEN a user clicks the "Create Spell" tab THEN the Sidebar SHALL show the Grimoire form
4. WHEN a spell is successfully created THEN the Sidebar SHALL switch to the "My Spells" tab and refresh the list

### Requirement 4

**User Story:** As a developer, I want the sidebar to maintain the grimoire theme, so that the experience remains visually consistent.

#### Acceptance Criteria

1. WHEN the sidebar form is displayed THEN the Sidebar SHALL use the dark grimoire color scheme (#1a120b background, #d4af37 gold accents)
2. WHEN form elements are focused THEN the Sidebar SHALL show gold glow effects
3. WHEN buttons are hovered THEN the Sidebar SHALL display subtle magical animations
4. WHEN the form is in error state THEN the Sidebar SHALL use the grimoire error color (#ff6b6b)

### Requirement 5

**User Story:** As a developer, I want quick access to example spells from the sidebar, so that I can quickly start with templates.

#### Acceptance Criteria

1. WHEN the Create Spell tab is active THEN the Sidebar SHALL display example spell buttons
2. WHEN a user clicks an example button THEN the Sidebar SHALL populate the form with example data
3. WHEN example data is loaded THEN the Sidebar SHALL trigger validation automatically
