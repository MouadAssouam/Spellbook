// kiro-generated
/**
 * Property-based tests for generator engine
 * 
 * Uses fast-check to verify correctness properties across random inputs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateMCPServer } from './generator.js';
import type { Spell, HTTPConfig, ScriptConfig } from './types.js';
import { z } from 'zod';

// ============================================================================
// Arbitraries (reuse from templates.test.ts)
// ============================================================================

const spellNameArb = fc.stringMatching(/^[a-zA-Z0-9-]{3,50}$/);
const descriptionArb = fc.string({ minLength: 100, maxLength: 500 });
const jsonSchemaArb = fc.record({
  type: fc.constant('object'),
  properties: fc.dictionary(
    fc.string(),
    fc.record({
      type: fc.constantFrom('string', 'number', 'boolean', 'object', 'array')
    })
  )
});

const httpConfigArb: fc.Arbitrary<HTTPConfig> = fc.record({
  url: fc.webUrl(),
  method: fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
  headers: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
  body: fc.option(fc.string(), { nil: undefined })
});

const scriptConfigArb: fc.Arbitrary<ScriptConfig> = fc.record({
  runtime: fc.constant('node' as const),
  code: fc.string({ minLength: 1 })
});

const spellArb: fc.Arbitrary<Spell> = fc.record({
  id: fc.uuid(),
  name: spellNameArb,
  description: descriptionArb,
  inputSchema: jsonSchemaArb,
  outputSchema: jsonSchemaArb,
  action: fc.oneof(
    fc.record({ type: fc.constant('http' as const), config: httpConfigArb }),
    fc.record({ type: fc.constant('script' as const), config: scriptConfigArb })
  )
});

// ============================================================================
// Property 1: Complete file generation
// ============================================================================

describe('Generator - Complete file generation', () => {
  it('Property 1: Always generates exactly 4 files', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        const files = generateMCPServer(spell);
        
        // Must have exactly 4 files
        const fileNames = Object.keys(files);
        expect(fileNames).toHaveLength(4);
        
        // Must have specific filenames
        expect(fileNames).toContain('Dockerfile');
        expect(fileNames).toContain('package.json');
        expect(fileNames).toContain('index.js');
        expect(fileNames).toContain('README.md');
      }),
      { numRuns: 100 }
    );
  });
  
  it('Property 1: All files have non-empty content', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        const files = generateMCPServer(spell);
        
        // All files must have content
        for (const [filename, content] of Object.entries(files)) {
          expect(content).toBeTruthy();
          expect(content.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 2: Validation enforcement
// ============================================================================

describe('Generator - Validation enforcement', () => {
  it('Property 2: Invalid spells throw ZodError', () => {
    // Invalid name (too short)
    const invalidSpell1 = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'ab',
      description: 'a'.repeat(100),
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      action: { type: 'http' as const, config: { url: 'http://test.com', method: 'GET' as const } }
    };
    
    expect(() => generateMCPServer(invalidSpell1 as any)).toThrow(z.ZodError);
    
    // Invalid description (too short)
    const invalidSpell2 = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'valid-name',
      description: 'short',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      action: { type: 'http' as const, config: { url: 'http://test.com', method: 'GET' as const } }
    };
    
    expect(() => generateMCPServer(invalidSpell2 as any)).toThrow(z.ZodError);
    
    // Invalid UUID
    const invalidSpell3 = {
      id: 'not-a-uuid',
      name: 'valid-name',
      description: 'a'.repeat(100),
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      action: { type: 'http' as const, config: { url: 'http://test.com', method: 'GET' as const } }
    };
    
    expect(() => generateMCPServer(invalidSpell3 as any)).toThrow(z.ZodError);
  });
  
  it('Property 2: Valid spells do not throw', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        // Should not throw
        expect(() => generateMCPServer(spell)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 3: Generator determinism
// ============================================================================

describe('Generator - Determinism', () => {
  it('Property 3: Same spell produces identical output', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        const files1 = generateMCPServer(spell);
        const files2 = generateMCPServer(spell);
        
        // Same keys
        expect(Object.keys(files1).sort()).toEqual(Object.keys(files2).sort());
        
        // Same content for each file
        for (const filename of Object.keys(files1)) {
          expect(files1[filename]).toBe(files2[filename]);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 4: File bundle structure
// ============================================================================

describe('Generator - File bundle structure', () => {
  it('Property 4: All keys are valid filenames', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        const files = generateMCPServer(spell);
        
        for (const filename of Object.keys(files)) {
          // Must be a non-empty string
          expect(typeof filename).toBe('string');
          expect(filename.length).toBeGreaterThan(0);
          
          // Must not contain path separators
          expect(filename).not.toContain('/');
          expect(filename).not.toContain('\\');
        }
      }),
      { numRuns: 100 }
    );
  });
  
  it('Property 4: All values are non-empty strings', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        const files = generateMCPServer(spell);
        
        for (const content of Object.values(files)) {
          expect(typeof content).toBe('string');
          expect(content.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 5: Action type support
// ============================================================================

describe('Generator - Action type support', () => {
  it('Property 5: HTTP actions generate successfully', () => {
    const httpSpellArb = fc.record({
      id: fc.uuid(),
      name: spellNameArb,
      description: descriptionArb,
      inputSchema: jsonSchemaArb,
      outputSchema: jsonSchemaArb,
      action: fc.record({ 
        type: fc.constant('http' as const), 
        config: httpConfigArb 
      })
    });
    
    fc.assert(
      fc.property(httpSpellArb, (spell) => {
        // Should not throw
        const files = generateMCPServer(spell);
        
        // Should generate all files
        expect(Object.keys(files)).toHaveLength(4);
        
        // Server code should contain fetch
        expect(files['index.js']).toContain('fetch');
      }),
      { numRuns: 100 }
    );
  });
  
  it('Property 5: Script actions generate successfully', () => {
    const scriptSpellArb = fc.record({
      id: fc.uuid(),
      name: spellNameArb,
      description: descriptionArb,
      inputSchema: jsonSchemaArb,
      outputSchema: jsonSchemaArb,
      action: fc.record({ 
        type: fc.constant('script' as const), 
        config: scriptConfigArb 
      })
    });
    
    fc.assert(
      fc.property(scriptSpellArb, (spell) => {
        // Should not throw
        const files = generateMCPServer(spell);
        
        // Should generate all files
        expect(Object.keys(files)).toHaveLength(4);
        
        // Server code should contain Function
        expect(files['index.js']).toContain('Function');
      }),
      { numRuns: 100 }
    );
  });
});
