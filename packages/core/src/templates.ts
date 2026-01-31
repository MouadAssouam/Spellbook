/**
 * @deprecated This module is deprecated. Use the AST compiler instead.
 * 
 * Migration guide:
 * - Before: import { templates } from 'spellbook-mcp';
 *           const files = generateMCPServer(spell);
 * 
 * - After:  import { generateMCPServerV2 } from 'spellbook-mcp';
 *           const files = generateMCPServerV2(spell, { telemetry: true });
 * 
 * The AST compiler provides:
 * - Pluggable compilation passes
 * - Better error messages
 * - Validation
 * - Telemetry injection
 * - Resilience patterns
 * 
 * This file will be removed in the next major version.
 */

console.warn(
  '[Spellbook] Warning: templates.ts is deprecated. ' +
  'Use generateMCPServerV2() with the AST compiler instead.'
);

export { templates } from './templates.legacy.js';
