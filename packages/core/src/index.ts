// kiro-generated
/**
 * @spellbook/core
 * 
 * Core types, schemas, and utilities for Spellbook MCP tool builder.
 */

// Types and Schemas
export {
  // Schemas
  HTTPConfigSchema,
  ScriptConfigSchema,
  ActionSchema,
  SpellSchema,
  // Types
  type HTTPConfig,
  type ScriptConfig,
  type Action,
  type Spell,
  // Constants
  MIN_NAME_LENGTH,
  MAX_NAME_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  NAME_PATTERN,
  // Helpers
  validateSpell
} from './types.js';

// Templates
export { templates } from './templates.js';

// Generator
export { generateMCPServer } from './generator.js';

// Storage
export { loadSpells, saveSpells, clearSpells, DEFAULT_SPELLS_FILE } from './storage.js';
