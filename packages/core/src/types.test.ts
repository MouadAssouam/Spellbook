// kiro-generated
/**
 * Property-based tests for Spellbook core types.
 * Uses fast-check for generating test inputs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  SpellSchema,
  HTTPConfigSchema,
  ScriptConfigSchema,
  MIN_NAME_LENGTH,
  MAX_NAME_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  NAME_PATTERN,
  validateSpell
} from './types.js';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/** Generate valid kebab-case names */
const validNameArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
    minLength: MIN_NAME_LENGTH,
    maxLength: MAX_NAME_LENGTH
  })
  .map(chars => chars.join(''))
  .filter(s => NAME_PATTERN.test(s) && s.length >= MIN_NAME_LENGTH);

/** Generate valid descriptions */
const validDescriptionArb = fc.string({
  minLength: MIN_DESCRIPTION_LENGTH,
  maxLength: MAX_DESCRIPTION_LENGTH
});

/** Generate valid UUIDs */
const uuidArb = fc.uuid();

/** Generate valid HTTP methods */
const httpMethodArb = fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE' as const);

/** Generate valid URLs */
const validUrlArb = fc.webUrl();

/** Generate valid HTTP configs */
const httpConfigArb = fc.record({
  url: validUrlArb,
  method: httpMethodArb,
  headers: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
  body: fc.option(fc.string(), { nil: undefined })
});

/** Generate valid script configs */
const scriptConfigArb = fc.record({
  runtime: fc.constant('node' as const),
  code: fc.string({ minLength: 1 })
});

/** Generate valid actions */
const actionArb = fc.oneof(
  fc.record({ type: fc.constant('http' as const), config: httpConfigArb }),
  fc.record({ type: fc.constant('script' as const), config: scriptConfigArb })
);

/** Generate valid spells */
const validSpellArb = fc.record({
  id: uuidArb,
  name: validNameArb,
  description: validDescriptionArb,
  inputSchema: fc.constant({}),
  outputSchema: fc.constant({}),
  action: actionArb
});

// ============================================================================
// Property Tests
// ============================================================================

describe('SpellSchema', () => {
  /**
   * **Feature: milestone-1-types, Property 1: Valid spells pass validation**
   * For any spell with valid fields, validation should succeed.
   */
  it('Property 1: Valid spells pass validation', () => {
    fc.assert(
      fc.property(validSpellArb, (spell) => {
        const result = SpellSchema.safeParse(spell);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: milestone-1-types, Property 2: Name validation regex**
   * Names matching the pattern and length should pass; others should fail.
   */
  it('Property 2: Name validation regex - valid names pass', () => {
    fc.assert(
      fc.property(validNameArb, (name) => {
        const spell = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name,
          description: 'A'.repeat(MIN_DESCRIPTION_LENGTH),
          inputSchema: {},
          outputSchema: {},
          action: { type: 'http', config: { url: 'https://example.com', method: 'GET' } }
        };
        const result = SpellSchema.safeParse(spell);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2: Name validation regex - invalid names fail', () => {
    // Names with invalid characters should fail
    fc.assert(
      fc.property(
        fc.string({ minLength: MIN_NAME_LENGTH, maxLength: MAX_NAME_LENGTH })
          .filter(s => !NAME_PATTERN.test(s)),
        (name) => {
          const spell = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name,
            description: 'A'.repeat(MIN_DESCRIPTION_LENGTH),
            inputSchema: {},
            outputSchema: {},
            action: { type: 'http', config: { url: 'https://example.com', method: 'GET' } }
          };
          const result = SpellSchema.safeParse(spell);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: milestone-1-types, Property 3: Description length validation**
   * Descriptions within bounds should pass; outside bounds should fail.
   */
  it('Property 3: Description length - valid lengths pass', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_DESCRIPTION_LENGTH, max: MAX_DESCRIPTION_LENGTH }),
        (length) => {
          const spell = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'test-spell',
            description: 'A'.repeat(length),
            inputSchema: {},
            outputSchema: {},
            action: { type: 'http', config: { url: 'https://example.com', method: 'GET' } }
          };
          const result = SpellSchema.safeParse(spell);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3: Description length - too short fails', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MIN_DESCRIPTION_LENGTH - 1 }),
        (length) => {
          const spell = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'test-spell',
            description: 'A'.repeat(length),
            inputSchema: {},
            outputSchema: {},
            action: { type: 'http', config: { url: 'https://example.com', method: 'GET' } }
          };
          const result = SpellSchema.safeParse(spell);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('HTTPConfigSchema', () => {
  /**
   * **Feature: milestone-1-types, Property 4: HTTP action validation**
   * Valid HTTP configs should pass regardless of optional fields.
   */
  it('Property 4: HTTP action validation - valid configs pass', () => {
    fc.assert(
      fc.property(httpConfigArb, (config) => {
        const result = HTTPConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4: HTTP action - URLs with template variables pass', () => {
    // Test that URLs with {{variable}} syntax are accepted
    const validUrlsWithTemplates = [
      'https://api.github.com/repos/{{owner}}/{{repo}}/issues',
      'https://example.com/api/{{endpoint}}',
      'http://localhost:3000/{{path}}',
      'https://api.stripe.com/v1/{{resource}}'
    ];
    
    validUrlsWithTemplates.forEach(url => {
      const config = { url, method: 'GET' as const };
      const result = HTTPConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});

describe('ScriptConfigSchema', () => {
  /**
   * **Feature: milestone-1-types, Property 5: Script action validation**
   * Valid script configs should pass.
   */
  it('Property 5: Script action validation - valid configs pass', () => {
    fc.assert(
      fc.property(scriptConfigArb, (config) => {
        const result = ScriptConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5: Script action - empty code fails', () => {
    const config = { runtime: 'node', code: '' };
    const result = ScriptConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});

describe('validateSpell', () => {
  /**
   * **Feature: milestone-1-types, Property 6: Validation errors include field paths**
   * Invalid inputs should return errors with non-empty paths.
   */
  it('Property 6: Validation errors include field paths', () => {
    // Invalid spell with bad name
    const result = validateSpell({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'ab', // too short
      description: 'short', // too short
      inputSchema: {},
      outputSchema: {},
      action: { type: 'http', config: { url: 'https://example.com', method: 'GET' } }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      // All errors should have paths
      result.errors.forEach(error => {
        expect(error.path).toBeDefined();
        expect(error.message).toBeDefined();
      });
    }
  });

  it('Property 6: Multiple validation errors are returned', () => {
    const result = validateSpell({
      id: 'not-a-uuid',
      name: 'x', // too short
      description: 'y', // too short
      inputSchema: {},
      outputSchema: {},
      action: { type: 'http', config: { url: 'not-a-url', method: 'GET' } }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Should have multiple errors
      expect(result.errors.length).toBeGreaterThan(1);
    }
  });
});
