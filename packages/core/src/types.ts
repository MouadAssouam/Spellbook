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
  /** Execution security mode (default: isolated for safety) */
  execution: z.enum(['unsafe', 'isolated']).default('isolated'),
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
// Auth Schema
// ============================================================================

/**
 * Configuration for OAuth 2.1 (Authorization Code Flow)
 */
export const OAuth2ConfigSchema = z.object({
  /** Client ID from the provider */
  clientId: z.string().min(1, 'Client ID is required'),
  /** Client Secret from the provider (optional if using env var) */
  clientSecret: z.string().min(1, 'Client Secret is required').optional(),
  /** Environment variable to read the client secret */
  clientSecretEnvVar: z.string().min(1).default('CLIENT_SECRET'),
  /** Authorization URL (where to redirect user) */
  authUrl: z.string().url('Invalid Authorization URL'),
  /** Token URL (where to swap code for token) */
  tokenUrl: z.string().url('Invalid Token URL'),
  /** Scopes (space separated) */
  scopes: z.array(z.string()).default([]),
  /** Environment variable to store the access token */
  tokenEnvVar: z.string().default('MCP_ACCESS_TOKEN')
});

/**
 * Configuration for tool authentication.
 * Defines how the tool authenticates with external services.
 */
export const AuthSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('apiKey'),
    envVar: z.string().min(1, 'Environment variable name is required'),
    headerKey: z.string().optional()
  }),
  z.object({
    type: z.literal('bearer'),
    envVar: z.string().min(1, 'Environment variable name is required')
  }),
  z.object({
    type: z.literal('oauth2'),
    config: OAuth2ConfigSchema
  })
]);

// ============================================================================
// Tool Definition Schema
// ============================================================================

/**
 * Definition of a single tool within the MCP server.
 */
export const ToolDefinitionSchema = z.object({
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
// Spell Schema
// ============================================================================

/**
 * Complete spell definition for generating an MCP tool.
 * Represents an MCP server that creates one or more tools.
 */
export const SpellSchema = z.object({
  /** Unique identifier (UUID v4) */
  id: z.string().uuid(),
  /** Server name - kebab-case, 3-50 characters */
  name: z
    .string()
    .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters`)
    .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters`)
    .regex(NAME_PATTERN, 'Name must contain only letters, numbers, and hyphens'),
  /** Server description - 100-500 characters */
  description: z
    .string()
    .min(MIN_DESCRIPTION_LENGTH, `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`)
    .max(MAX_DESCRIPTION_LENGTH, `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`),
  /** Optional authentication configuration */
  auth: AuthSchema.optional(),
  /** Transport mode (default: 'stdio') */
  transport: z.enum(['stdio', 'sse']).default('stdio'),
  /** List of tools this server provides */
  tools: z.array(ToolDefinitionSchema).min(1, 'At least one tool is required')
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

/** Tool definition */
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

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
