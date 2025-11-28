// kiro-generated
/**
 * Storage Module Tests
 * 
 * Tests for spell persistence functionality.
 * 
 * **Feature: milestone-7-mcp-tool**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { loadSpells, saveSpells, clearSpells } from './storage.js';
import { SpellSchema, type Spell } from './types.js';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { randomUUID } from 'crypto';

// Test file path (isolated from production)
const TEST_SPELLS_FILE = resolve(process.cwd(), '.kiro/data/test-spells.json');

// Helper to create valid test spells
function createTestSpell(overrides: Partial<Spell> = {}): Spell {
  return {
    id: randomUUID(),
    name: 'test-spell',
    description: 'A test spell for unit testing purposes. This description needs to be at least 100 characters long to pass validation.',
    action: {
      type: 'http',
      config: {
        url: 'https://api.example.com/test',
        method: 'GET'
      }
    },
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    ...overrides
  };
}

// Cleanup before and after tests
beforeEach(async () => {
  await clearSpells(TEST_SPELLS_FILE);
});

afterEach(async () => {
  await clearSpells(TEST_SPELLS_FILE);
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Storage - Property Tests', () => {
  /**
   * **Feature: milestone-7-mcp-tool, Property 3: Storage round-trip preserves spells**
   * **Validates: Requirements 2.3, 4.3**
   */
  it('Property 3: Storage round-trip preserves spells', async () => {
    // Create multiple test spells
    const spells = new Map<string, Spell>();
    for (let i = 0; i < 5; i++) {
      const spell = createTestSpell({ 
        id: randomUUID(),
        name: `test-spell-${i}`
      });
      spells.set(spell.id, spell);
    }

    // Save to storage
    await saveSpells(spells, TEST_SPELLS_FILE);

    // Load back
    const loaded = await loadSpells(TEST_SPELLS_FILE);

    // Verify same size
    expect(loaded.size).toBe(spells.size);

    // Verify each spell is preserved
    for (const [id, original] of spells) {
      const loaded_spell = loaded.get(id);
      expect(loaded_spell).toBeDefined();
      expect(loaded_spell?.name).toBe(original.name);
      expect(loaded_spell?.description).toBe(original.description);
    }
  });

  /**
   * **Feature: milestone-7-mcp-tool, Property 2: Created spells are persisted**
   * **Validates: Requirements 1.4, 2.1**
   */
  it('Property 2: Created spells are persisted and retrievable', async () => {
    const spell = createTestSpell();
    const spells = new Map<string, Spell>();
    spells.set(spell.id, spell);

    // Save
    await saveSpells(spells, TEST_SPELLS_FILE);

    // Load in new map (simulating restart)
    const loaded = await loadSpells(TEST_SPELLS_FILE);

    // Verify spell exists
    expect(loaded.has(spell.id)).toBe(true);
    expect(loaded.get(spell.id)?.name).toBe(spell.name);
  });
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('Storage - Unit Tests', () => {
  it('loadSpells returns empty map when file does not exist', async () => {
    const spells = await loadSpells(TEST_SPELLS_FILE);
    expect(spells.size).toBe(0);
  });

  it('saveSpells creates directory if it does not exist', async () => {
    const nestedPath = resolve(process.cwd(), '.kiro/data/nested/test-spells.json');
    const spell = createTestSpell();
    const spells = new Map<string, Spell>();
    spells.set(spell.id, spell);

    await saveSpells(spells, nestedPath);

    // Verify file was created
    const loaded = await loadSpells(nestedPath);
    expect(loaded.size).toBe(1);

    // Cleanup
    await fs.unlink(nestedPath);
    await fs.rmdir(dirname(nestedPath));
  });

  it('loadSpells handles corrupted JSON gracefully', async () => {
    // Write invalid JSON
    const dir = dirname(TEST_SPELLS_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(TEST_SPELLS_FILE, 'not valid json {{{', 'utf-8');

    // Should return empty map, not throw
    const spells = await loadSpells(TEST_SPELLS_FILE);
    expect(spells.size).toBe(0);
  });

  it('loadSpells handles non-array JSON gracefully', async () => {
    // Write object instead of array
    const dir = dirname(TEST_SPELLS_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(TEST_SPELLS_FILE, '{"not": "an array"}', 'utf-8');

    // Should return empty map
    const spells = await loadSpells(TEST_SPELLS_FILE);
    expect(spells.size).toBe(0);
  });

  it('clearSpells removes the storage file', async () => {
    // Create a spell first
    const spell = createTestSpell();
    const spells = new Map<string, Spell>();
    spells.set(spell.id, spell);
    await saveSpells(spells, TEST_SPELLS_FILE);

    // Clear
    await clearSpells(TEST_SPELLS_FILE);

    // Verify empty
    const loaded = await loadSpells(TEST_SPELLS_FILE);
    expect(loaded.size).toBe(0);
  });

  it('multiple saves accumulate spells correctly', async () => {
    // First spell
    const spell1 = createTestSpell({ name: 'spell-one' });
    const spells1 = new Map<string, Spell>();
    spells1.set(spell1.id, spell1);
    await saveSpells(spells1, TEST_SPELLS_FILE);

    // Load, add second spell, save again
    const loaded = await loadSpells(TEST_SPELLS_FILE);
    const spell2 = createTestSpell({ name: 'spell-two' });
    loaded.set(spell2.id, spell2);
    await saveSpells(loaded, TEST_SPELLS_FILE);

    // Verify both exist
    const final = await loadSpells(TEST_SPELLS_FILE);
    expect(final.size).toBe(2);
    expect(Array.from(final.values()).map(s => s.name)).toContain('spell-one');
    expect(Array.from(final.values()).map(s => s.name)).toContain('spell-two');
  });
});


// ============================================================================
// Additional Property Tests for MCP Tool
// ============================================================================

describe('MCP Tool - Property Tests', () => {
  /**
   * **Feature: milestone-7-mcp-tool, Property 1: Valid spells generate complete file bundles**
   * **Validates: Requirements 1.1, 1.2**
   */
  it('Property 1: Valid spells generate complete file bundles', async () => {
    // Import generator
    const { generateMCPServer } = await import('./generator.js');
    
    const spell = createTestSpell();
    const files = generateMCPServer(spell);
    
    // Verify all 4 files generated
    expect(Object.keys(files)).toHaveLength(4);
    expect(files['Dockerfile']).toBeDefined();
    expect(files['package.json']).toBeDefined();
    expect(files['index.js']).toBeDefined();
    expect(files['README.md']).toBeDefined();
  });

  /**
   * **Feature: milestone-7-mcp-tool, Property 4: Invalid spells are rejected with errors**
   * **Validates: Requirements 1.2, 1.3**
   */
  it('Property 4: Invalid spells are rejected with errors', () => {
    // Invalid spell - name too short
    const invalidSpell = {
      id: randomUUID(),
      name: 'ab', // Too short (min 3)
      description: 'A test spell for unit testing purposes. This description needs to be at least 100 characters long to pass validation.',
      action: {
        type: 'http' as const,
        config: {
          url: 'https://api.example.com/test',
          method: 'GET' as const
        }
      },
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' }
    };

    const result = SpellSchema.safeParse(invalidSpell);
    expect(result.success).toBe(false);
  });
});
