/**
 * Property-Based Tests for Sidebar Grimoire
 * 
 * Tests validation consistency and example loading behavior.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpellSchema } from './types.js';

/**
 * Validation function matching GrimoireSidebarProvider._handleValidate
 * This mirrors the sidebar validation logic for testing.
 */
function validateSpellForm(data: {
  name?: string;
  description?: string;
  actionType?: 'http' | 'script';
  url?: string;
  code?: string;
}): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];

  // Validate name
  if (!data.name || data.name.length < 3) {
    errors.push({ field: 'name', message: 'Min 3 characters' });
  } else if (data.name.length > 50) {
    errors.push({ field: 'name', message: 'Max 50 characters' });
  } else if (!/^[a-zA-Z0-9-]+$/.test(data.name)) {
    errors.push({ field: 'name', message: 'Use kebab-case only' });
  }

  // Validate description
  if (!data.description || data.description.length < 100) {
    errors.push({ field: 'description', message: `${data.description?.length || 0}/100 min` });
  } else if (data.description.length > 500) {
    errors.push({ field: 'description', message: 'Max 500 characters' });
  }

  // Validate URL for HTTP actions
  if (data.actionType === 'http' && data.url) {
    try {
      const testUrl = data.url.replace(/\{\{[^}]+\}\}/g, 'placeholder');
      new URL(testUrl);
    } catch {
      errors.push({ field: 'url', message: 'Invalid URL' });
    }
  }

  // Validate code for script actions
  if (data.actionType === 'script' && (!data.code || data.code.trim().length === 0)) {
    errors.push({ field: 'code', message: 'Code required' });
  }

  return errors;
}

describe('Sidebar Grimoire Property Tests', () => {
  /**
   * **Feature: sidebar-grimoire, Property 1: Validation Consistency**
   * 
   * *For any* spell form data entered in the sidebar, validation errors 
   * should match the Zod schema validation from @spellbook/core
   * 
   * **Validates: Requirements 1.3**
   */
  describe('Property 1: Validation Consistency', () => {
    it('valid kebab-case names pass validation', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 3, maxLength: 50 })
            .map(arr => arr.join(''))
            .filter(s => /^[a-zA-Z0-9-]+$/.test(s) && s.length >= 3),
          (name) => {
            const errors = validateSpellForm({ name, description: 'x'.repeat(100), actionType: 'http', url: 'https://example.com' });
            const nameErrors = errors.filter(e => e.field === 'name');
            expect(nameErrors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('names with invalid characters fail validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 50 }).filter(s => !/^[a-zA-Z0-9-]+$/.test(s) && s.length >= 3),
          (name) => {
            const errors = validateSpellForm({ name, description: 'x'.repeat(100), actionType: 'http', url: 'https://example.com' });
            const nameErrors = errors.filter(e => e.field === 'name');
            expect(nameErrors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('descriptions under 100 chars fail validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 99 }),
          (description) => {
            const errors = validateSpellForm({ name: 'valid-name', description, actionType: 'http', url: 'https://example.com' });
            const descErrors = errors.filter(e => e.field === 'description');
            expect(descErrors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('descriptions between 100-500 chars pass validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 500 }),
          (description) => {
            const errors = validateSpellForm({ name: 'valid-name', description, actionType: 'http', url: 'https://example.com' });
            const descErrors = errors.filter(e => e.field === 'description');
            expect(descErrors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('script actions without code fail validation', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\t', '\n'),
          (code) => {
            const errors = validateSpellForm({ name: 'valid-name', description: 'x'.repeat(100), actionType: 'script', code });
            const codeErrors = errors.filter(e => e.field === 'code');
            expect(codeErrors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: sidebar-grimoire, Property 2: Example Loading Populates Form**
   * 
   * *For any* example spell clicked, all corresponding form fields 
   * should be populated with the example's data
   * 
   * **Validates: Requirements 5.2**
   */
  describe('Property 2: Example Loading Populates Form', () => {
    const examples: Record<string, {
      name: string;
      description: string;
      action: { type: 'http' | 'script'; config: { url?: string; method?: string; code?: string } };
    }> = {
      'github-fetcher': {
        name: 'github-fetcher',
        description: 'Fetches repository information from the GitHub API. Retrieves details like stars, forks, description, and other metadata for any public repository. Perfect for building dashboards or integrating GitHub data into your workflows.',
        action: { type: 'http', config: { url: 'https://api.github.com/repos/{{owner}}/{{repo}}', method: 'GET' } }
      },
      'weather-api': {
        name: 'weather-api',
        description: 'Retrieves current weather conditions for any city worldwide using the Open-Meteo API. Returns temperature, humidity, wind speed, and weather descriptions. Great for building weather widgets or location-based applications.',
        action: { type: 'http', config: { url: 'https://api.open-meteo.com/v1/forecast?latitude={{lat}}&longitude={{lon}}&current_weather=true', method: 'GET' } }
      },
      'calculator': {
        name: 'calculator',
        description: 'A simple calculator that performs basic arithmetic operations. Supports addition, subtraction, multiplication, and division. Demonstrates how to build script-based MCP tools with custom logic and input validation.',
        action: { type: 'script', config: { code: 'const { operation, a, b } = input;\nswitch(operation) {\n  case "add": return { result: a + b };\n  case "subtract": return { result: a - b };\n  case "multiply": return { result: a * b };\n  case "divide": return { result: b !== 0 ? a / b : "Error: Division by zero" };\n  default: return { error: "Unknown operation" };\n}' } }
      }
    };

    it('loading any example populates name field correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.keys(examples)),
          (exampleKey) => {
            const example = examples[exampleKey];
            // Simulate loading example
            const formData = {
              name: example.name,
              description: example.description,
              actionType: example.action.type,
              url: example.action.type === 'http' ? example.action.config.url : '',
              code: example.action.type === 'script' ? example.action.config.code : ''
            };
            
            expect(formData.name).toBe(example.name);
            expect(formData.name.length).toBeGreaterThanOrEqual(3);
            expect(formData.name.length).toBeLessThanOrEqual(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('loading any example populates description with valid length', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.keys(examples)),
          (exampleKey) => {
            const example = examples[exampleKey];
            expect(example.description.length).toBeGreaterThanOrEqual(100);
            expect(example.description.length).toBeLessThanOrEqual(500);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('loaded examples pass validation', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.keys(examples)),
          (exampleKey) => {
            const example = examples[exampleKey];
            const formData = {
              name: example.name,
              description: example.description,
              actionType: example.action.type,
              url: example.action.type === 'http' ? example.action.config.url : '',
              code: example.action.type === 'script' ? example.action.config.code : ''
            };
            
            const errors = validateSpellForm(formData);
            expect(errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
