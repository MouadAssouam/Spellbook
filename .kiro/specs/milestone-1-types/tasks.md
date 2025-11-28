# Implementation Plan

- [x] 1. Create core type schemas




  - [x] 1.1 Create HTTPConfigSchema

    - Define url (string.url), method (enum), optional headers and body
    - _Requirements: 2.1, 2.2_

  - [x] 1.2 Create ScriptConfigSchema

    - Define runtime (literal 'node'), code (string.min(1))

    - _Requirements: 3.1_
  - [x] 1.3 Create ActionSchema as discriminated union


    - Use z.discriminatedUnion with 'type' discriminator

    - _Requirements: 2.1, 3.1_


  - [x] 1.4 Create SpellSchema


    - Define id (uuid), name (3-50, regex), description (100-500), schemas, action

    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Export types and schemas

  - [x] 2.1 Infer TypeScript types from schemas

    - Use z.infer<typeof Schema> for each schema
    - _Requirements: 1.4_
  - [x] 2.2 Create index.ts with public exports

    - Export all schemas and types
    - _Requirements: 1.4_

- [x] 3. Write property-based tests


  - [x] 3.1 Install fast-check testing library

    - npm install -D fast-check
    - _Requirements: 1.1_

  - [x] 3.2 Write property test for valid spell validation

    - **Property 1: Valid spells pass validation**
    - **Validates: Requirements 1.1**
  - [x] 3.3 Write property test for name validation

    - **Property 2: Name validation regex**
    - **Validates: Requirements 1.2**
  - [x] 3.4 Write property test for description length

    - **Property 3: Description length validation**
    - **Validates: Requirements 1.3**
  - [x] 3.5 Write property test for HTTP action

    - **Property 4: HTTP action validation**
    - **Validates: Requirements 2.1, 2.2**
  - [x] 3.6 Write property test for script action

    - **Property 5: Script action validation**
    - **Validates: Requirements 3.1**
  - [x] 3.7 Write property test for error paths



    - **Property 6: Validation errors include field paths**
    - **Validates: Requirements 4.1**


- [x] 4. Checkpoint - Verify types work


  - Ensure all tests pass, ask the user if questions arise.
