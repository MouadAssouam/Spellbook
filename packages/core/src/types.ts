// kiro-generated
/**
 * Spellbook Core Types
 * 
 * Zod schemas and TypeScript types for spell definitions.
 * These types form the foundation for MCP tool generation.
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 50;
export const MIN_DESCRIPTION_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 500;
export const NAME_PATTERN = /^[a-zA-Z0-9-]+$/;

// ============================================================================
// HTTP Config Schema
// ============================================================================

/**
 * Configuration for HTTP-based spell actions.
 * URLs support {{variable}} template syntax for interpolation.
 */
export const HTTPConfigSchema = z.object({
  /** Target URL - supports {{var}} template syntax */
  url: z.string().url(),
  /** HTTP method */
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  /** Optional HTTP headers */
  headers: z.record(z.string()).optional(),
  /** Optional request body template */
  body: z.string().optional()
});

// ============================================================================
// Script Config Schema
// ============================================================================

/**
 * Configuration for script-based spell actions.
 * Currently only Node.js runtime is supported.
 */
export const ScriptConfigSchema = z.object({
  /** Execution runtime (currently only 'node') */
  runtime: z.literal('node'),
  /** JavaScript code to execute */
  code: z.string().min(1, 'Code must not be empty')
});

// ============================================================================
// Action Schema (Discriminated Union)
// ============================================================================

/**
 * Action defines what a spell does when invoked.
 * Either makes an HTTP request or executes a script.
 */
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('http'),
    config: HTTPConfigSchema
  }),
  z.object({
    type: z.literal('script'),
    config: ScriptConfigSchema
  })
]);

// ============================================================================
// Spell Schema
// ============================================================================

/**
 * Complete spell definition for generating an MCP tool.
 */
export const SpellSchema = z.object({
  /** Unique identifier (UUID v4) */
  id: z.string().uuid(),
  /** Tool name - kebab-case, 3-50 characters */
  name: z
    .string()
    .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters`)
    .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters`)
    .regex(NAME_PATTERN, 'Name must contain only letters, numbers, and hyphens'),
  /** Tool description - 100-500 characters */
  description: z
    .string()
    .min(MIN_DESCRIPTION_LENGTH, `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`)
    .max(MAX_DESCRIPTION_LENGTH, `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`),
  /** JSON Schema for tool input */
  inputSchema: z.object({}).passthrough(),
  /** JSON Schema for tool output */
  outputSchema: z.object({}).passthrough(),
  /** Action to perform (HTTP or Script) */
  action: ActionSchema
});

// ============================================================================
// Inferred TypeScript Types
// ============================================================================

/** HTTP action configuration */
export type HTTPConfig = z.infer<typeof HTTPConfigSchema>;

/** Script action configuration */
export type ScriptConfig = z.infer<typeof ScriptConfigSchema>;

/** Action (HTTP or Script) */
export type Action = z.infer<typeof ActionSchema>;

/** Complete spell definition */
export type Spell = z.infer<typeof SpellSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates a spell definition and returns typed result.
 * Uses safeParse to avoid throwing exceptions.
 */
export function validateSpell(data: unknown): {
  success: true;
  data: Spell;
} | {
  success: false;
  errors: Array<{ path: string; message: string; code: string }>;
} {
  const result = SpellSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: result.error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
      code: e.code
    }))
  };
}
