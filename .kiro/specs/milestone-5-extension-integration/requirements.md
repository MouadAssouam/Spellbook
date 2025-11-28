# Requirements Document - Milestone 5: Extension Integration & Polish

## Introduction

This milestone focuses on polishing the VS Code extension with better user experience, schema collection, and professional touches that make it production-ready.

## Glossary

- **Schema Builder**: Interactive prompts for building JSON schemas
- **Progress Indicator**: Visual feedback during file generation
- **Input Validation**: Real-time validation of user inputs
- **User Experience (UX)**: The overall experience of using the extension

## Requirements

### Requirement 1

**User Story:** As a developer, I want to define input and output schemas interactively, so that I don't have to write JSON manually

#### Acceptance Criteria

1. WHEN creating a spell THEN the system SHALL prompt for input schema properties
2. WHEN adding a property THEN the system SHALL prompt for property name and type
3. THE system SHALL support common types (string, number, boolean, object, array)
4. WHEN done adding properties THEN the system SHALL allow proceeding
5. THE system SHALL repeat the process for output schema
6. THE generated schemas SHALL be valid JSON Schema

### Requirement 2

**User Story:** As a developer, I want to see progress during generation, so that I know the extension is working

#### Acceptance Criteria

1. WHEN generation starts THEN the system SHALL show a progress notification
2. THE progress notification SHALL indicate what step is happening
3. WHEN generation completes THEN the system SHALL hide the progress notification
4. THE progress SHALL not block other VS Code operations

### Requirement 3

**User Story:** As a developer, I want better validation messages, so that I understand what's wrong

#### Acceptance Criteria

1. WHEN validation fails THEN the system SHALL show specific error details
2. THE error messages SHALL include examples of valid input
3. THE error messages SHALL be concise and actionable
4. THE validation SHALL happen in real-time as user types

### Requirement 4

**User Story:** As a developer, I want to add optional HTTP headers and body, so that I can create more complex HTTP actions

#### Acceptance Criteria

1. WHEN action type is HTTP THEN the system SHALL ask if headers are needed
2. IF headers are needed THEN the system SHALL prompt for header key-value pairs
3. WHEN action type is HTTP POST/PUT/PATCH THEN the system SHALL ask if body is needed
4. IF body is needed THEN the system SHALL prompt for body template
5. THE body template SHALL support {{variable}} placeholders

### Requirement 5

**User Story:** As a developer, I want example spells, so that I can quickly create common tools

#### Acceptance Criteria

1. THE system SHALL provide a "Use Example" option
2. WHEN "Use Example" is selected THEN the system SHALL show example spell options
3. THE examples SHALL include GitHub Fetcher, Weather API, Calculator
4. WHEN an example is selected THEN the system SHALL pre-fill all fields
5. THE user SHALL be able to modify the pre-filled values
