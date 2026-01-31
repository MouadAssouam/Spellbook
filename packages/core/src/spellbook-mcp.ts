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
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { SpellSchema } from './types.js';
import { generateMCPServer } from './generator.js';
import { loadSpells, saveSpells } from './storage.js';

// ============================================================================
// Server Setup
// ============================================================================

const MAX_REMOTE_BYTES = 5 * 1024 * 1024; // 5MB safety cap

function isPrivateIp(address: string): boolean {
  if (address.includes(':')) {
    const normalized = address.toLowerCase();
    return normalized === '::1' ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd');
  }

  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

async function assertSafeUrl(rawUrl: string): Promise<void> {
  const parsed = new URL(rawUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Protocol not allowed: ${parsed.protocol}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('Localhost is not allowed');
  }

  const ipType = isIP(host);
  if (ipType && isPrivateIp(host)) {
    throw new Error('Private or loopback IPs are not allowed');
  }

  if (!ipType) {
    const results = await lookup(host, { all: true });
    for (const result of results) {
      if (isPrivateIp(result.address)) {
        throw new Error('Private or loopback IPs are not allowed');
      }
    }
  }
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error(`Response too large: ${contentLength} bytes (max ${maxBytes} bytes)`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) {
      throw new Error(`Response too large: ${text.length} bytes (max ${maxBytes} bytes)`);
    }
    return text;
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel();
      throw new Error(`Response too large: exceeded ${maxBytes} bytes`);
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }

  return chunks.join('');
}

const server = new Server(
  { name: 'spellbook', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

import { parseOpenAPI } from './openapi.js';

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
            description: 'Server name in kebab-case (3-50 characters)',
            minLength: 3,
            maxLength: 50
          },
          description: {
            type: 'string',
            description: 'Server description (100-500 characters)',
            minLength: 100,
            maxLength: 500
          },
          auth: {
            type: 'object',
            description: 'Server authentication configuration',
            properties: {
              type: {
                type: 'string',
                enum: ['apiKey', 'bearer']
              },
              envVar: { type: 'string' },
              headerKey: { type: 'string' }
            },
            required: ['type', 'envVar']
          },
          tools: {
            type: 'array',
            description: 'List of tools to include in this server',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Tool name in kebab-case'
                },
                description: {
                  type: 'string',
                  description: 'Tool description'
                },
                inputSchema: { type: 'object' },
                outputSchema: { type: 'object' },
                action: {
                  type: 'object',
                  properties: {
                    type: { enum: ['http', 'script'] },
                    config: { type: 'object' }
                  },
                  required: ['type', 'config']
                }
              },
              required: ['name', 'description', 'inputSchema', 'outputSchema', 'action']
            }
          },
          outputDir: {
            type: 'string',
            description: 'Optional directory path to write generated files.'
          }
        },
        required: ['name', 'description', 'tools']
      }
    },
    {
      name: 'update_spell',
      description: 'Update an existing spell definition. Replaces the entire spell config (tools, auth, etc) but preserves the ID.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Server name in kebab-case (spell to update)'
          },
          description: {
            type: 'string',
            description: 'New server description (100-500 characters)',
            minLength: 100,
            maxLength: 500
          },
          auth: {
            type: 'object',
            description: 'New authentication configuration',
            properties: {
              type: {
                type: 'string',
                enum: ['apiKey', 'bearer']
              },
              envVar: { type: 'string' },
              headerKey: { type: 'string' }
            },
            required: ['type', 'envVar']
          },
          tools: {
            type: 'array',
            description: 'New list of tools (replaces all existing tools)',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Tool name in kebab-case'
                },
                description: {
                  type: 'string',
                  description: 'Tool description'
                },
                inputSchema: { type: 'object' },
                outputSchema: { type: 'object' },
                action: {
                  type: 'object',
                  properties: {
                    type: { enum: ['http', 'script'] },
                    config: { type: 'object' }
                  },
                  required: ['type', 'config']
                }
              },
              required: ['name', 'description', 'inputSchema', 'outputSchema', 'action']
            }
          },
          outputDir: {
            type: 'string',
            description: 'Optional directory path to write generated files.'
          }
        },
        required: ['name', 'description', 'tools']
      }
    },
    {
      name: 'import_openapi',
      description: 'Import an OpenAPI/Swagger specification (JSON) and create an MCP server from it.',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to the OpenAPI JSON specification',
            format: 'uri'
          },
          spec: {
            type: 'string',
            description: 'JSON string content of the OpenAPI specification'
          },
          outputDir: {
            type: 'string',
            description: 'Optional directory path to write generated files.'
          }
        },
        oneOf: [
          { required: ['url'] },
          { required: ['spec'] }
        ]
      }
    },
    {
      name: 'export_spell',
      description: 'Export a spell definition to JSON.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the spell to export'
          }
        },
        required: ['name']
      }
    },
    {
      name: 'import_spell',
      description: 'Import a spell from a JSON definition (URL, file path, or content).',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to valid Spell JSON' },
          filePath: { type: 'string', description: 'Local path to valid Spell JSON' },
          content: { type: 'string', description: 'Raw JSON string of Spell definition' },
          outputDir: { type: 'string', description: 'Optional output directory for generation' }
        },
        oneOf: [
          { required: ['url'] },
          { required: ['filePath'] },
          { required: ['content'] }
        ]
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

  if (name === 'update_spell') {
    return handleUpdateSpell(args);
  }

  if (name === 'import_openapi') {
    return handleImportOpenAPI(args);
  }

  if (name === 'export_spell') {
    return handleExportSpell(args);
  }

  if (name === 'import_spell') {
    return handleImportSpell(args);
  }

  if (name === 'list_spells') {
    return handleListSpells();
  }

  throw new Error(`Unknown tool: ${name}`);
});

/**
 * Handles export_spell tool invocation.
 */
async function handleExportSpell(args: unknown) {
  try {
    const { name } = args as { name: string };
    const spells = await loadSpells();

    // Find spell by name ( inefficient but fine for this scale)
    const spell = Array.from(spells.values()).find(s => s.name === name);

    if (!spell) {
      throw new Error(`Spell "${name}" not found.`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(spell, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: ` Error exporting spell: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Handles import_spell tool invocation.
 */
async function handleImportSpell(args: unknown) {
  try {
    const { url, filePath, content, outputDir } = args as {
      url?: string;
      filePath?: string;
      content?: string;
      outputDir?: string;
    };

    let spellData: any;

    if (content) {
      spellData = JSON.parse(content);
    } else if (url) {
      await assertSafeUrl(url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch spell from ${url}: ${response.statusText}`);
      const text = await readBodyWithLimit(response, MAX_REMOTE_BYTES);
      spellData = JSON.parse(text);
    } else if (filePath) {
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      spellData = JSON.parse(fileContent);
    } else {
      throw new Error('Must provide url, filePath, or content');
    }

    // Reuse handleCreateSpell.
    // We pass spellData properties as args. 
    // handleCreateSpell will re-validate and generate a NEW ID.
    // This is desired behavior (importing a copy).
    return handleCreateSpell({
      ...spellData,
      outputDir
    });

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: ` Error importing spell: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Handles import_openapi tool invocation.
 * Fetches/parses the spec and delegates to handleCreateSpell logic.
 */
async function handleImportOpenAPI(args: unknown) {
  try {
    const { url, spec, outputDir } = args as { url?: string; spec?: string; outputDir?: string };
    let jsonSpec: any;

    if (url) {
      await assertSafeUrl(url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec from ${url}: ${response.statusText}`);
      }
      const text = await readBodyWithLimit(response, MAX_REMOTE_BYTES);
      jsonSpec = JSON.parse(text);
    } else if (spec) {
      jsonSpec = JSON.parse(spec);
    } else {
      throw new Error('Either url or spec must be provided');
    }

    const spell = parseOpenAPI(jsonSpec);

    // Delegate to handleCreateSpell logic by just calling it?
    // handleCreateSpell expects "args" matching the schema.
    // We can just construct the args and call it.

    // NOTE: handleCreateSpell generates a new ID. parseOpenAPI also generates one.
    // handleCreateSpell will overwrite it. That's fine.

    // We reuse handleCreateSpell to ensure consistency in file generation, registration, etc.
    return handleCreateSpell({
      name: spell.name,
      description: spell.description,
      tools: spell.tools,
      outputDir
    });

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: ` Error importing OpenAPI: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

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
          text: ` Spell with name "${spell.name}" already exists (id: ${existingSpell.id}).\n\nEach spell name must be unique. Choose a different name or delete the existing spell first.`
        }],
        isError: true
      };
    }

    // Generate MCP server files
    const files = generateMCPServer(spell);

    // Add new spell and save
    spells.set(spell.id, spell);
    await saveSpells(spells);

    // Write files to disk if outputDir is provided
    const outputDir = (args as { outputDir?: string }).outputDir;

    let writeStatus = '';
    let autoRegisterStatus = '';
    let installStatus = '';

    if (outputDir) {
      try {
        const targetDir = join(outputDir, spell.name);
        await mkdir(targetDir, { recursive: true });

        for (const [filename, content] of Object.entries(files)) {
          await writeFile(join(targetDir, filename), content, 'utf-8');
        }

        writeStatus = `\n\n Files written to: ${targetDir}/`;

        // Auto-register to mcp.json
        try {
          // Locate .kiro/settings/mcp.json (assuming we are running from root or 2 levels deep)
          // For now, let's look for it relative to CWD if possible, or try standard paths
          // This is a simplified approach, a more robust one would walk up the tree
          const kiroMcpPath = join(process.cwd(), '.kiro/settings/mcp.json');
          // We might need to handle cases where it doesn't exist or is elsewhere
          const fs = await import('fs/promises'); // Dynamic import to be safe/consistent 

          let mcpConfig: any = { mcpServers: {} };
          try {
            const mcpContent = await fs.readFile(kiroMcpPath, 'utf-8');
            mcpConfig = JSON.parse(mcpContent);
          } catch (e) {
            // File doesn't exist or is invalid, start fresh
          }

          if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

          mcpConfig.mcpServers[spell.name] = {
            command: "docker",
            args: ["run", "--rm", "-i", spell.name]
          };

          await fs.writeFile(kiroMcpPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
          autoRegisterStatus = `\n\n Auto-registered to: ${kiroMcpPath}`;

        } catch (regError) {
          autoRegisterStatus = `\n\n Could not auto-register to mcp.json.`;
        }


        // Auto-install dependencies
        try {
          const { exec } = await import('child_process');
          await new Promise<void>((resolve, reject) => {
            exec('npm install', { cwd: targetDir }, (error) => {
              if (error) reject(error);
              else resolve();
            });
          });
          installStatus = `\n\n Dependencies installed successfully`;
        } catch (instError) {
          installStatus = `\n\n Could not install dependencies: ${instError instanceof Error ? instError.message : String(instError)}`;
        }


      } catch (writeError) {
        writeStatus = `\n\n Could not write files: ${writeError instanceof Error ? writeError.message : String(writeError)}`;
      }
    }

    // Build file list for response
    const fileList = Object.keys(files)
      .map(f => `  - ${f}`)
      .join('\n');

    const nextSteps = outputDir
      ? `Next steps:\n1. cd ${join(outputDir, spell.name)}\n2. Run: docker build -t ${spell.name} .`
      : `Next steps:\n1. Save the generated files to a directory\n2. Run: docker build -t ${spell.name} .\n3. Add to .kiro/settings/mcp.json`;

    return {
      content: [
        {
          type: 'text',
          text: ` Server "${spell.name}" created successfully with ${spell.tools.length} tool(s)!\n\nGenerated files:\n${fileList}${writeStatus}${installStatus}${autoRegisterStatus}\n\nPersisted to: .kiro/data/spells.json\n\n${nextSteps}`
        },
        {
          type: 'text',
          text: `\n Generated Files:\n\n--- Dockerfile ---\n${files['Dockerfile']}\n--- index.js ---\n${files['index.js'].substring(0, 500)}...\n\n(README.md also generated)`
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
          text: ` Spell validation failed:\n${issues}`
        }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: ` Error creating spell: ${error instanceof Error ? error.message : String(error)}`
      }],
      isError: true
    };
  }
}

/**
 * Handles update_spell tool invocation.
 * Updates an existing spell definition while preserving ID.
 */
async function handleUpdateSpell(args: unknown) {
  try {
    const input = args as { name?: string; outputDir?: string };

    // Load existing spells
    const spells = await loadSpells();

    // Check availability
    const existingSpell = Array.from(spells.values()).find(s => s.name === input.name);
    if (!existingSpell) {
      return {
        content: [{
          type: 'text',
          text: ` Spell with name "${input.name}" not found. Cannot update.`
        }],
        isError: true
      };
    }

    // Build spell data using EXISTING ID and new attributes
    const spellData = {
      ...(args as object),
      id: existingSpell.id
    };

    // Validate against schema
    const spell = SpellSchema.parse(spellData);

    // Generate MCP server files
    const files = generateMCPServer(spell);

    // Update spell and save
    spells.set(spell.id, spell);
    await saveSpells(spells);

    // Write files to disk if outputDir is provided (Duplicate logic from create)
    const outputDir = input.outputDir;
    let writeStatus = '';
    let autoRegisterStatus = '';
    let installStatus = '';

    if (outputDir) {
      try {
        const targetDir = join(outputDir, spell.name);
        await mkdir(targetDir, { recursive: true });

        for (const [filename, content] of Object.entries(files)) {
          await writeFile(join(targetDir, filename), content, 'utf-8');
        }

        writeStatus = `\n\n Files updated in: ${targetDir}/`;

        // Auto-register (Idempotent usually)
        try {
          const kiroMcpPath = join(process.cwd(), '.kiro/settings/mcp.json');
          const fs = await import('fs/promises');
          let mcpConfig: any = { mcpServers: {} };
          try {
            const mcpContent = await fs.readFile(kiroMcpPath, 'utf-8');
            mcpConfig = JSON.parse(mcpContent);
          } catch { /* ignore */ }

          if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
          mcpConfig.mcpServers[spell.name] = {
            command: "docker",
            args: ["run", "--rm", "-i", spell.name]
          };
          await fs.writeFile(kiroMcpPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
        } catch { /* ignore */ }

        // Auto-install dependencies
        try {
          const { exec } = await import('child_process');
          await new Promise<void>((resolve, reject) => {
            exec('npm install', { cwd: targetDir }, (error) => {
              if (error) reject(error);
              else resolve();
            });
          });
          installStatus = `\n\n Dependencies updated successfully`;
        } catch (instError) {
          installStatus = `\n\n Could not install dependencies: ${instError instanceof Error ? instError.message : String(instError)}`;
        }

      } catch (writeError) {
        writeStatus = `\n\n Could not write files: ${writeError instanceof Error ? writeError.message : String(writeError)}`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: ` Server "${spell.name}" updated successfully!\n\n${writeStatus}${installStatus}\n\nPersisted to: .kiro/data/spells.json`
        }
      ]
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as { errors?: Array<{ path: string[]; message: string }> };
      const issues = zodError.errors?.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n') || error.message;
      return {
        content: [{ type: 'text', text: ` Spell validation failed:\n${issues}` }],
        isError: true
      };
    }
    return {
      content: [{ type: 'text', text: ` Error updating spell: ${error instanceof Error ? error.message : String(error)}` }],
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
          text: ' No spells created yet.\n\nUse create_spell to summon your first MCP tool!'
        }]
      };
    }

    const spellList = Array.from(spells.values())
      .map(s => `   ${s.name}\n     ${s.description.substring(0, 80)}...`)
      .join('\n\n');

    return {
      content: [{
        type: 'text',
        text: ` Your Spellbook (${spells.size} spell${spells.size === 1 ? '' : 's'}):\n\n${spellList}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: ` Error loading spells: ${error instanceof Error ? error.message : String(error)}`
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
