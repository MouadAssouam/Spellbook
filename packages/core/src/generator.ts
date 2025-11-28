// kiro-generated
/**
 * Spellbook Generator Engine
 * 
 * Orchestrates spell validation and MCP server file generation.
 * Combines types and templates into a complete generation system.
 */

import { Spell, SpellSchema } from './types.js';
import { templates } from './templates.js';

// ============================================================================
// Generator Function
// ============================================================================

/**
 * Generates all files needed for an MCP server from a spell definition.
 * 
 * This is the main entry point for MCP server generation. It validates
 * the spell definition and produces all necessary files ready for deployment.
 * 
 * @param spell - Spell definition to generate MCP server from
 * @returns Object mapping filenames to file contents
 * @throws {ZodError} If spell validation fails
 * 
 * @example
 * ```typescript
 * const spell: Spell = {
 *   id: '123e4567-e89b-12d3-a456-426614174000',
 *   name: 'github-fetcher',
 *   description: 'Fetches GitHub issues...',
 *   inputSchema: { type: 'object', properties: { repo: { type: 'string' } } },
 *   outputSchema: { type: 'array' },
 *   action: { type: 'http', config: { url: 'https://api.github.com', method: 'GET' } }
 * };
 * 
 * const files = generateMCPServer(spell);
 * // files = {
 * //   'Dockerfile': '...',
 * //   'package.json': '...',
 * //   'index.js': '...',
 * //   'README.md': '...'
 * // }
 * ```
 */
export function generateMCPServer(spell: Spell): Record<string, string> {
  // Validate spell (throws ZodError if invalid)
  const validated = SpellSchema.parse(spell);
  
  // Generate all files using templates
  const files = {
    'Dockerfile': templates.dockerfile(validated),
    'package.json': templates.packageJson(validated),
    'index.js': templates.serverCode(validated),
    'README.md': templates.readme(validated)
  };
  
  return files;
}
