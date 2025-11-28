#!/usr/bin/env node
// kiro-generated
/**
 * Spellbook MCP Server
 * 
 * The "meta moment" - an MCP tool that creates other MCP tools.
 * Exposes create_spell and list_spells tools via stdio transport.
 * 
 * Usage:
 *   node spellbook-mcp.js
 * 
 * Or add to .kiro/settings/mcp.json:
 *   {
 *     "mcpServers": {
 *       "spellbook": {
 *         "command": "node",
 *         "args": ["path/to/spellbook-mcp.js"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import { SpellSchema } from './types.js';
import { generateMCPServer } from './generator.js';
import { loadSpells, saveSpells } from './storage.js';

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  { name: 'spellbook', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ============================================================================
// Tool Definitions
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'create_spell',
      description: 'Create a new MCP tool from a spell definition. Generates Dockerfile, package.json, index.js, and README.md.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Tool name in kebab-case (3-50 characters)',
            minLength: 3,
            maxLength: 50
          },
          description: {
            type: 'string',
            description: 'Tool description (100-500 characters)',
            minLength: 100,
            maxLength: 500
          },
          inputSchema: {
            type: 'object',
            description: 'JSON Schema for tool input'
          },
          outputSchema: {
            type: 'object',
            description: 'JSON Schema for tool output'
          },
          action: {
            type: 'object',
            description: 'Action configuration (HTTP or Script)',
            properties: {
              type: {
                type: 'string',
                enum: ['http', 'script'],
                description: 'Action type'
              },
              config: {
                type: 'object',
                description: 'Action-specific configuration'
              }
            },
            required: ['type', 'config']
          }
        },
        required: ['name', 'description', 'inputSchema', 'outputSchema', 'action']
      }
    },
    {
      name: 'list_spells',
      description: 'List all created spells with their names and descriptions.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ]
}));

// ============================================================================
// Tool Handlers
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'create_spell') {
    return handleCreateSpell(args);
  }

  if (name === 'list_spells') {
    return handleListSpells();
  }

  throw new Error(`Unknown tool: ${name}`);
});

// ============================================================================
// Handler Implementations
// ============================================================================

/**
 * Handles create_spell tool invocation.
 * Validates input, generates files, and persists the spell.
 */
async function handleCreateSpell(args: unknown) {
  try {
    // Build spell with generated UUID
    const spellData = {
      id: randomUUID(),
      ...(args as object)
    };

    // Validate against schema (throws ZodError if invalid)
    const spell = SpellSchema.parse(spellData);

    // Load existing spells
    const spells = await loadSpells();
    
    // Check for duplicate spell names (Self-Enforcing Architecture)
    const existingSpell = Array.from(spells.values()).find(s => s.name === spell.name);
    if (existingSpell) {
      return {
        content: [{
          type: 'text',
          text: `❌ Spell with name "${spell.name}" already exists (id: ${existingSpell.id}).\n\nEach spell name must be unique. Choose a different name or delete the existing spell first.`
        }],
        isError: true
      };
    }

    // Generate MCP server files
    const files = generateMCPServer(spell);

    // Add new spell and save
    spells.set(spell.id, spell);
    await saveSpells(spells);

    // Build file list for response
    const fileList = Object.keys(files)
      .map(f => `  - ${f}`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `✨ Spell "${spell.name}" created successfully!\n\nGenerated files:\n${fileList}\n\nPersisted to: .kiro/data/spells.json\n\nNext steps:\n1. Save the generated files to a directory\n2. Run: docker build -t ${spell.name} .\n3. Add to .kiro/settings/mcp.json:\n   {\n     "mcpServers": {\n       "${spell.name}": {\n         "command": "docker",\n         "args": ["run", "--rm", "-i", "${spell.name}"]\n       }\n     }\n   }`
        },
        {
          type: 'text',
          text: `\n📄 Generated Files:\n\n--- Dockerfile ---\n${files['Dockerfile']}\n--- package.json ---\n${files['package.json']}\n--- index.js ---\n${files['index.js'].substring(0, 500)}...\n\n(README.md also generated)`
        }
      ]
    };
  } catch (error) {
    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as { errors?: Array<{ path: string[]; message: string }> };
      const issues = zodError.errors?.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n') || error.message;
      return {
        content: [{
          type: 'text',
          text: `❌ Spell validation failed:\n${issues}`
        }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: `❌ Error creating spell: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Handles list_spells tool invocation.
 * Returns all persisted spells.
 */
async function handleListSpells() {
  try {
    const spells = await loadSpells();

    if (spells.size === 0) {
      return {
        content: [{
          type: 'text',
          text: '📜 No spells created yet.\n\nUse create_spell to summon your first MCP tool!'
        }]
      };
    }

    const spellList = Array.from(spells.values())
      .map(s => `  🔮 ${s.name}\n     ${s.description.substring(0, 80)}...`)
      .join('\n\n');

    return {
      content: [{
        type: 'text',
        text: `📜 Your Spellbook (${spells.size} spell${spells.size === 1 ? '' : 's'}):\n\n${spellList}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error loading spells: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

// ============================================================================
// Transport Setup
// ============================================================================

const transport = new StdioServerTransport();
await server.connect(transport);
