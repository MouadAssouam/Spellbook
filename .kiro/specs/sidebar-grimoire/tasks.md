# Implementation Plan

- [x] 1. Create GrimoireSidebarProvider

  - [x] 1.1 Create GrimoireSidebarProvider class implementing WebviewViewProvider


    - Implement resolveWebviewView method
    - Set up message handling



    - _Requirements: 1.1_
  - [x] 1.2 Register the WebviewViewProvider in extension.ts

    - Register with vscode.window.registerWebviewViewProvider
    - Update package.json with new view contribution
    - _Requirements: 1.1_

  - [x] 1.3 Write property test for validation consistency

    - **Property 1: Validation Consistency**
    - **Validates: Requirements 1.3**

- [x] 2. Build tabbed sidebar HTML/CSS

  - [x] 2.1 Create tab navigation UI

    - "My Spells" and "Create Spell" tab buttons
    - Tab switching JavaScript logic
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.2 Create compact spell form layout

    - Smaller inputs optimized for sidebar width
    - Scrollable container for overflow

    - _Requirements: 2.1, 2.2_

  - [x] 2.3 Apply grimoire theme to sidebar

    - Dark background, gold accents
    - Compact spacing and font sizes
    - _Requirements: 4.1, 4.2, 4.3, 4.4_


- [x] 3. Implement My Spells tab

  - [x] 3.1 Create spell list rendering

    - Display spell name and description
    - Click to open spell folder
    - _Requirements: 3.2_



  - [x] 3.2 Add refresh functionality

    - Scan workspace for spell directories
    - Update list on spell creation
    - _Requirements: 3.4_

- [x] 4. Implement Create Spell tab

  - [x] 4.1 Port form fields from GrimoirePanel

    - Name input with validation
    - Description textarea with char count
    - Action type selector (HTTP/Script)
    - _Requirements: 1.2_

  - [x] 4.2 Add HTTP/Script configuration fields

    - URL and method for HTTP
    - Code textarea for Script

    - _Requirements: 1.2_



  - [x] 4.3 Implement real-time validation

    - Validate on input change
    - Show inline error messages

    - Enable/disable Summon button



    - _Requirements: 1.3_

  - [x] 4.4 Write property test for example loading

    - **Property 2: Example Loading Populates Form**
    - **Validates: Requirements 5.2**

- [x] 5. Implement example spell loading

  - [x] 5.1 Add example buttons to Create tab

    - GitHub Fetcher, Weather API, Calculator
    - Compact button styling
    - _Requirements: 5.1_

  - [x] 5.2 Wire up example loading

    - Populate form on click
    - Trigger validation after load
    - _Requirements: 5.2, 5.3_

- [x] 6. Implement spell generation

  - [x] 6.1 Add Summon Spell button with loading state

    - Show spinner during generation
    - Disable form while generating
    - _Requirements: 1.1_


  - [x] 6.2 Handle generation success

    - Show success message
    - Switch to My Spells tab
    - Refresh spell list



    - _Requirements: 3.4_


  - [x] 6.3 Handle generation errors

    - Display error message
    - Keep form data for correction
    - _Requirements: 1.3_

- [x] 7. Update package.json and cleanup

  - [x] 7.1 Add sidebar view contribution to package.json

    - Register grimoireView in spellbook-sidebar
    - Remove old spellsView if replacing
    - _Requirements: 1.1_

  - [x] 7.2 Update extension activation

    - Register GrimoireSidebarProvider
    - Keep GrimoirePanel as optional fallback


    - _Requirements: 1.1_




  - [x] 7.3 Rebuild and test extension

    - npm run compile
    - npm run package
    - Manual testing of sidebar
    - _Requirements: All_

- [x] 8. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.
