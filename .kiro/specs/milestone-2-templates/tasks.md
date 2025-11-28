# Implementation Plan

- [x] 1. Create template module structure


  - [x] 1.1 Create templates.ts file



    - Create `packages/core/src/templates.ts`
    - Import Spell type from types.ts
    - Set up module structure with exports
    - _Requirements: 5.1, 5.2, 5.3, 5.4_


- [x] 2. Implement Dockerfile template


  - [x] 2.1 Create dockerfile template function


    - Implement function that returns Dockerfile string
    - Use Node.js 20 Alpine base image
    - Include WORKDIR, COPY, RUN, CMD directives
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Write property test for Dockerfile template


    - **Property 2: Valid Dockerfile syntax**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 7.2**



- [x] 3. Implement package.json template


  - [x] 3.1 Create packageJson template function


    - Implement function that returns package.json string
    - Include name derived from spell name
    - Include required dependencies (@modelcontextprotocol/sdk, zod)
    - Set type to "module"
    - Include main entry point
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Write property test for package.json template


    - **Property 3: Valid package.json structure**

    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.3**


- [x] 4. Implement server code template



  - [x] 4.1 Create helper function for action code generation


    - Implement generateActionCode(action: Action) helper
    - Handle HTTP action type (generate fetch code)
    - Handle script action type (generate execution code)
    - Support {{variable}} interpolation for HTTP
    - Include headers when present
    - Include body when present
    - _Requirements: 3.5, 3.6, 3.8, 6.1, 6.2, 6.3, 6.4_

  - [x] 4.2 Create serverCode template function


    - Implement function that returns server code string
    - Include MCP SDK imports
    - Include Server initialization
    - Include ListToolsRequestSchema handler
    - Include CallToolRequestSchema handler
    - Include stdio transport setup
    - Use generateActionCode helper
    - Include error handling
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [x] 4.3 Write property test for server code template


    - **Property 4: Valid server code syntax**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 7.4**

  - [x] 4.4 Write property test for action type handling


    - **Property 5: Action type handling**
    - **Validates: Requirements 3.5, 3.6, 6.1, 6.2**

  - [x] 4.5 Write property test for HTTP configuration


    - **Property 6: HTTP configuration completeness**
    - **Validates: Requirements 6.3, 6.4**

  - [x] 4.6 Write property test for interpolation support



    - **Property 8: Template interpolation support**

    - **Validates: Requirements 3.8**

- [ ] 5. Implement README template

  - [x] 5.1 Create readme template function


    - Implement function that returns README.md string
    - Include spell name as title
    - Include spell description
    - Include Docker build instructions
    - Include mcp.json configuration example
    - Include input schema documentation
    - Include output schema documentation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 5.2 Write property test for README template




    - **Property 7: README completeness**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.5**

- [x] 6. Write determinism property test


  - [x] 6.1 Write property test for template determinism


    - **Property 1: Template determinism**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [x] 7. Export templates object



  - [x] 7.1 Create and export templates object

    - Export object with all four template functions
    - Ensure proper TypeScript types
    - Update index.ts to export templates
    - _Requirements: 5.1_

- [x] 8. Checkpoint - Verify templates work


  - Ensure all tests pass, ask the user if questions arise.
