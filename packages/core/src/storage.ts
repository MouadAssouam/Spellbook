// kiro-generated
/**
 * Spellbook Persistent Storage
 * 
 * File-based storage for spells that persists across restarts.
 * Stores spells in .kiro/data/spells.json.
 * 
 * SECURITY NOTE: Spells may contain sensitive data (API keys, tokens) in
 * headers or body templates. This storage is NOT encrypted. Users should:
 * - Use environment variables for secrets instead of hardcoding
 * - Ensure .kiro/data/ is in .gitignore
 * - Consider file system permissions on the storage directory
 */

import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { SpellSchema, type Spell } from './types.js';

// ============================================================================
// Storage Configuration
// ============================================================================

/**
 * Default path for spell storage file.
 * Can be overridden for testing.
 */
export const DEFAULT_SPELLS_FILE = resolve(process.cwd(), '.kiro/data/spells.json');

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Loads spells from persistent storage.
 * 
 * @param filePath - Path to spells file (defaults to .kiro/data/spells.json)
 * @returns Map of spell ID to spell object
 * 
 * @example
 * ```typescript
 * const spells = await loadSpells();
 * console.log(`Loaded ${spells.size} spells`);
 * ```
 */
export async function loadSpells(filePath: string = DEFAULT_SPELLS_FILE): Promise<Map<string, Spell>> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Validate it's an array
    if (!Array.isArray(parsed)) {
      return new Map();
    }
    
    // Validate each spell against schema, skip invalid entries
    const validSpells = new Map<string, Spell>();
    for (const item of parsed) {
      const result = SpellSchema.safeParse(item);
      if (result.success) {
        validSpells.set(result.data.id, result.data);
      }
      // Invalid spells are silently skipped to prevent corrupted data from breaking the system
    }
    
    return validSpells;
  } catch (error) {
    // File doesn't exist or is corrupted - return empty map
    // This is expected on first run
    return new Map();
  }
}

/**
 * Saves spells to persistent storage.
 * Creates the directory if it doesn't exist.
 * 
 * @param spells - Map of spell ID to spell object
 * @param filePath - Path to spells file (defaults to .kiro/data/spells.json)
 * 
 * @example
 * ```typescript
 * const spells = new Map();
 * spells.set(spell.id, spell);
 * await saveSpells(spells);
 * ```
 */
export async function saveSpells(
  spells: Map<string, Spell>,
  filePath: string = DEFAULT_SPELLS_FILE
): Promise<void> {
  // Ensure directory exists
  const dir = dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  
  // Convert map to array and save as JSON
  const data = Array.from(spells.values());
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Clears all spells from storage.
 * Useful for testing.
 * 
 * @param filePath - Path to spells file (defaults to .kiro/data/spells.json)
 */
export async function clearSpells(filePath: string = DEFAULT_SPELLS_FILE): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // File doesn't exist, nothing to clear
  }
}
