# Implementation Plan

- [x] 1. Create storage module

  - [x] 1.1 Create storage.ts file
    - Create `packages/core/src/storage.ts`
    - Define SPELLS_FILE path constant (.kiro/data/spells.json)
    - Implement loadSpells() function
    - Implement saveSpells() function
    - Handle missing directory creation
    - Handle corrupted file gracefully
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.2 Write property test for storage round-trip
    - **Property 3: Storage round-trip preserves spells**
    - **Validates: Requirements 2.3, 4.3**

- [x] 2. Create MCP server

  - [x] 2.1 Create spellbook-mcp.ts file
    - Create `packages/core/src/spellbook-mcp.ts`
    - Import Server, StdioServerTransport from MCP SDK
    - Import SpellSchema, generateMCPServer from core
    - Import storage functions
    - Initialize server with name "spellbook"
    - _Requirements: 3.1, 3.2_

  - [x] 2.2 Implement ListToolsRequestSchema handler
    - Return create_spell tool definition with input schema
    - Return list_spells tool definition
    - _Requirements: 3.2_

  - [x] 2.3 Implement create_spell handler
    - Generate UUID for new spell
    - Validate spell with SpellSchema
    - Call generateMCPServer to create files
    - Persist spell to storage
    - Return success response with file summary
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 2.4 Implement list_spells handler
    - Load spells from storage
    - Format spell list for display
    - Return helpful message if no spells exist
    - _Requirements: 2.1, 2.2_

  - [x] 2.5 Implement error handling
    - Catch validation errors and return clear messages
    - Handle unknown tool requests
    - _Requirements: 1.3_

  - [x] 2.6 Set up stdio transport
    - Create StdioServerTransport
    - Connect server to transport
    - _Requirements: 3.1, 3.3_

- [x] 3. Write property tests

  - [x] 3.1 Write property test for valid spell generation
    - **Property 1: Valid spells generate complete file bundles**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 3.2 Write property test for spell persistence
    - **Property 2: Created spells are persisted**
    - **Validates: Requirements 1.4, 2.1**

  - [x] 3.3 Write property test for invalid spell rejection
    - **Property 4: Invalid spells are rejected with errors**
    - **Validates: Requirements 1.2, 1.3**

- [x] 4. Update package exports

  - [x] 4.1 Update index.ts exports
    - Export storage functions
    - Do NOT export spellbook-mcp (it's a standalone server)
    - _Requirements: 1.1_

  - [x] 4.2 Add bin entry to package.json
    - Add "bin" field pointing to spellbook-mcp.js
    - Ensure executable permissions
    - _Requirements: 3.1_

- [x] 5. Create mcp.json configuration

  - [x] 5.1 Create .kiro/settings/mcp.json
    - Add spellbook server configuration
    - Use node command with path to compiled server
    - _Requirements: 3.1_

- [x] 6. Checkpoint - Verify MCP tool works

  - Ensure all tests pass, ask the user if questions arise.
