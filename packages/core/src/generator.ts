// kiro-generated
/**
 * Spellbook Generator Engine
 * 
 * Orchestrates spell validation and MCP server file generation.
 * 
 * V1 (Legacy): Uses templates.ts - string concatenation
 * V2 (Recommended): Uses AST compiler - proper AST transformation
 */

import { Spell, SpellSchema } from './types.js';
import { templates } from './templates.legacy.js';
import { compileSpell, type CompilerOptions } from './compiler/index.js';

// ============================================================================
// V2 Generator (AST Compiler) - RECOMMENDED
// ============================================================================

/**
 * Generates MCP server files using the AST compiler.
 * 
 * This is the recommended approach using proper AST transformation
 * with configurable compilation passes.
 * 
 * @param spell - Spell definition to generate MCP server from
 * @param options - Compiler options (telemetry, resilience, etc.)
 * @returns Object mapping filenames to file contents
 */
export function generateMCPServerV2(
  spell: Spell,
  options?: CompilerOptions
): Record<string, string> {
  const result = compileSpell(spell, options);

  if (!result.success) {
    throw new Error(`Compilation failed: ${result.errors?.join(', ')}`);
  }

  return result.files!;
}

// ============================================================================
// V1 Generator (Templates) - LEGACY
// ============================================================================

/**
 * @deprecated Use generateMCPServerV2() which uses the AST compiler.
 * This function will be removed in a future version.
 * 
 * Generates all files needed for an MCP server from a spell definition.
 * Uses string template concatenation (legacy approach).
 * 
 * @param spell - Spell definition to generate MCP server from
 * @returns Object mapping filenames to file contents
 * @throws {ZodError} If spell validation fails
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

  const authScript = templates.oauthSetup(validated);
  if (authScript) {
    (files as any)['setup-auth.js'] = authScript;
  }

  return files;
}
