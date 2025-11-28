# Implementation Plan

- [x] 1. Create example spell JSON files

  - [x] 1.1 Create github-fetcher.json
    - Export GitHub Fetcher example with valid UUID
    - Include HTTP GET action with URL interpolation
    - Place in examples/ directory
    - _Requirements: 1.1, 6.1, 6.2_

  - [x] 1.2 Create weather-api.json
    - Export Weather API example with valid UUID
    - Include HTTP GET action with multiple URL parameters
    - Place in examples/ directory
    - _Requirements: 1.2, 6.1, 6.2_

  - [x] 1.3 Create calculator.json
    - Export Calculator example with valid UUID
    - Include Script action with arithmetic code
    - Place in examples/ directory
    - _Requirements: 1.3, 6.1, 6.2_

- [x] 2. Create integration test suite

  - [x] 2.1 Create examples.test.ts file
    - Create `packages/core/src/examples.test.ts`
    - Import generator, schemas, and example files
    - Set up test structure for each example
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Write property test for complete file generation
    - **Property 1: Generator produces complete file bundles**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 2.3 Write property test for package.json validity
    - **Property 2: Generated package.json is valid JSON with required dependencies**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x] 2.4 Write property test for Dockerfile best practices
    - **Property 3: Generated Dockerfile follows Node.js best practices**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 2.5 Write property test for JavaScript syntax validity
    - **Property 4: Generated server code is syntactically valid JavaScript**
    - **Validates: Requirements 4.1**

  - [x] 2.6 Write property test for HTTP action implementation
    - **Property 5: HTTP action spells include fetch implementation**
    - **Validates: Requirements 4.2**

  - [x] 2.7 Write property test for Script action implementation
    - **Property 6: Script action spells include Function constructor**
    - **Validates: Requirements 4.3**

  - [x] 2.8 Write property test for URL interpolation
    - **Property 7: URL interpolation is included when needed**
    - **Validates: Requirements 4.4**

  - [x] 2.9 Write property test for README completeness
    - **Property 8: README contains required documentation sections**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [x] 2.10 Write property test for JSON round-trip
    - **Property 9: Example spells round-trip through JSON serialization**
    - **Validates: Requirements 6.1, 6.3**

- [x] 3. Test each example spell individually

  - [x] 3.1 Test GitHub Fetcher generation
    - Load github-fetcher.json
    - Generate MCP server files
    - Verify all 4 files present
    - Verify URL interpolation in server code
    - Verify README contains correct name and description

  - [x] 3.2 Test Weather API generation
    - Load weather-api.json
    - Generate MCP server files
    - Verify all 4 files present
    - Verify multiple URL parameters handled
    - Verify README contains correct name and description

  - [x] 3.3 Test Calculator generation
    - Load calculator.json
    - Generate MCP server files
    - Verify all 4 files present
    - Verify Function constructor in server code
    - Verify README contains correct name and description

- [x] 4. Checkpoint - Verify all example tests pass

  - Ensure all tests pass, ask the user if questions arise.
