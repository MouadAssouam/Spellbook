# Implementation Plan

- [x] 1. Set up extension structure

  - [x] 1.1 Update extension package.json
    - Add extension metadata (name, displayName, description)
    - Add activation events for command
    - Add command contribution
    - Add dependency on @spellbook/core
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 1.2 Create extension.ts entry point
    - Implement activate() function
    - Register command
    - Implement deactivate() function
    - _Requirements: 1.1, 1.4_

- [x] 2. Implement spell creation command

  - [x] 2.1 Create create-spell.ts command file
    - Implement createSpellCommand() function
    - Check for workspace folder
    - Handle no workspace error
    - _Requirements: 4.2_

  - [x] 2.2 Implement input collection
    - Prompt for spell name with validation
    - Prompt for description with validation
    - Prompt for action type (HTTP/Script)
    - Prompt for HTTP details (URL, method) if HTTP
    - Prompt for script code if Script
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 2.3 Implement file generation and saving
    - Build spell object with UUID
    - Call generateMCPServer from @spellbook/core
    - Create spell directory in workspace
    - Write all 4 files to directory
    - Handle file system errors
    - _Requirements: 3.1, 3.2, 3.3, 4.3_

  - [x] 2.4 Implement success handling
    - Show success notification
    - Open README.md file
    - _Requirements: 3.4, 3.5_

  - [x] 2.5 Implement error handling
    - Show validation error messages
    - Show file system error messages
    - Clean up partial files on error
    - _Requirements: 4.1, 4.3, 4.4_

- [x] 3. Build and test extension

  - [x] 3.1 Compile TypeScript
    - Run tsc to compile extension
    - Verify no compilation errors
    - _Requirements: 5.1_

  - [x] 3.2 Manual testing
    - Load extension in VS Code
    - Test command availability
    - Test with valid inputs
    - Test with invalid inputs
    - Test error cases
    - Verify files created correctly
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_

- [x] 4. Checkpoint - Verify extension works
  - Extension loads and command works ✓
