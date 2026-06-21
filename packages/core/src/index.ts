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
  AuthSchema,
  ToolDefinitionSchema,
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

// Templates (DEPRECATED - use AST compiler instead)
// Intentionally NOT exported from the public surface. Import from
// '@spellbook/core/internal' if you genuinely need the legacy templates.
export { templates } from './templates.legacy.js';

// Generator
export { generateMCPServer, generateMCPServerV2 } from './generator.js';

// Storage
export { loadSpells, saveSpells, clearSpells, DEFAULT_SPELLS_FILE } from './storage.js';

// OpenAPI
export { parseOpenAPI, parseOpenApiSpec } from './openapi.js';

// Runtime (production utilities)
export * as runtime from './runtime/index.js';

// AST Compiler
export * as compiler from './compiler/index.js';

// Schema Inference (for API testing)
export {
  inferSchema,
  inferSimpleSchema,
  extractUrlParameters,
  generateInputSchemaFromUrl,
  type JSONSchema
} from './schema-inference.js';

// Magic Auto-Generate (S-grade feature: URL → Complete Spell)
export { magicFromUrl, magicToSpell, type MagicResult, type GeneratedSpell, type ResponseMeta } from './magic.js';
export {
  bulkTestTools,
  type BulkTestTool,
  type BulkTestOptions,
  type BulkTestReport,
  type BulkTestResult
} from './bulk-test.js';

// Watch Mode (API Change Detection - the feature AI cannot replicate)
export {
  diffSchemas,
  checkForChanges,
  WatchManager,
  getWatchManager,
  resetWatchManager,
  type WatchConfig,
  type SchemaChange,
  type WatchResult
} from './api-watcher.js';

