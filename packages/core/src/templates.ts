// kiro-generated
/**
 * Spellbook Template System
 * 
 * Pure functions that generate MCP server files from Spell definitions.
 * Each template produces a complete file ready for deployment.
 */

import type { Spell, Action } from './types.js';

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Templates object containing all file generation functions.
 * Each function is pure: same input → same output, no side effects.
 */
export const templates = {
  dockerfile,
  packageJson,
  serverCode,
  readme
};

// ============================================================================
// Dockerfile Template
// ============================================================================

/**
 * Generates a Dockerfile for containerizing the MCP server.
 * Uses Node.js 20 Alpine for minimal image size.
 */
function dockerfile(_spell: Spell): string {
  return `FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
CMD ["node", "index.js"]
`;
}

// ============================================================================
// package.json Template
// ============================================================================

/**
 * Generates package.json with dependencies and metadata.
 * Configures ES modules and includes MCP SDK.
 */
function packageJson(spell: Spell): string {
  const pkg = {
    name: `spell-${spell.name}`,
    version: '1.0.0',
    type: 'module',
    main: 'index.js',
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.0.0',
      'ajv': '^8.12.0'
    }
  };
  
  return formatJson(pkg);
}

// ============================================================================
// Server Code Template
// ============================================================================

/**
 * Generates the MCP server implementation.
 * Handles tool registration, request processing, and action execution.
 */
function serverCode(spell: Spell): string {
  const needsInterpolation = checkNeedsInterpolation(spell);
  const hasOutputSchema = spell.outputSchema && Object.keys(spell.outputSchema.properties || {}).length > 0;
  const needsHttpHelpers = spell.action.type === 'http';
  
  return `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import Ajv from 'ajv';

// JSON Schema validation using Ajv
const ajv = new Ajv({ allErrors: true, coerceTypes: true });
const inputSchema = ${formatJson(spell.inputSchema)};
const outputSchema = ${formatJson(spell.outputSchema)};
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

// Security: Configurable via environment variables
const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',').map(h => h.trim()) : ['*'];
const MAX_RESPONSE_SIZE = parseInt(process.env.MAX_RESPONSE_SIZE) || 10 * 1024 * 1024; // 10MB default

${needsInterpolation ? generateInterpolateFunction() + '\n' : ''}
${needsHttpHelpers ? generateReadBodyWithLimitFunction() + '\n' : ''}
// Server setup
const server = new Server({
  name: '${escapeString(spell.name)}',
  version: '1.0.0'
}, {
  capabilities: { tools: {} }
});

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: '${escapeString(spell.name)}',
    description: '${escapeString(spell.description)}',
    inputSchema: ${formatJson(spell.inputSchema)}
  }]
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== '${escapeString(spell.name)}') {
    throw new Error(\`Unknown tool: \${request.params.name}\`);
  }
  
  try {
    const input = request.params.arguments || {};
    
    // Validate input against JSON Schema using Ajv
    if (!validateInput(input)) {
      const errors = validateInput.errors?.map(e => \`\${e.instancePath} \${e.message}\`).join(', ');
      throw new Error(\`Invalid input: \${errors}\`);
    }
    
    const result = await executeAction(input);
    
    // Validate output against JSON Schema (enforced)
    ${hasOutputSchema ? `if (!validateOutput(result)) {
      const errors = validateOutput.errors?.map(e => \`\${e.instancePath} \${e.message}\`).join(', ');
      throw new Error(\`Output validation failed: \${errors}\`);
    }` : '// Note: No output schema properties defined - skipping output validation'}
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ 
          error: errorMessage,
          details: errorStack ? errorStack.split('\\n').slice(0, 3).join('\\n') : undefined
        }, null, 2)
      }],
      isError: true
    };
  }
});

// Action execution
async function executeAction(input) {
${generateActionCode(spell.action)}
}

// Transport setup
const transport = new StdioServerTransport();
await server.connect(transport);
`;
}

// ============================================================================
// README Template
// ============================================================================

/**
 * Generates documentation for the MCP tool.
 * Includes installation, usage, and schema information.
 */
function readme(spell: Spell): string {
  const isScript = spell.action.type === 'script';
  const securityNote = isScript 
    ? `## Security Notice

This tool executes JavaScript code with full Node.js privileges. Only run this tool if you trust the source code. For production use with untrusted inputs, consider using a sandboxed runtime like vm2 or isolated-vm.`
    : `## Security Notice

This tool makes HTTP requests to external services. The following security measures are in place:
- Request timeout: 15 seconds
- Response size limit: 10MB
- Host allowlist: Edit \`ALLOWED_HOSTS\` in index.js to restrict to specific domains`;

  return `# ${spell.name}

${spell.description}

${securityNote}

## Installation

\`\`\`bash
docker build -t ${spell.name} .
\`\`\`

## Usage in Kiro

Add to \`.kiro/settings/mcp.json\`:

\`\`\`json
{
  "mcpServers": {
    "${spell.name}": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "${spell.name}"]
    }
  }
}
\`\`\`

## Input Schema

\`\`\`json
${formatJson(spell.inputSchema)}
\`\`\`

## Output Schema

\`\`\`json
${formatJson(spell.outputSchema)}
\`\`\`

## Configuration

Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| \`ALLOWED_HOSTS\` | \`*\` (all) | Comma-separated list of allowed domains |
| \`MAX_RESPONSE_SIZE\` | \`10485760\` | Max response size in bytes (10MB) |
| \`HTTP_TIMEOUT_MS\` | \`15000\` | HTTP request timeout in milliseconds |
| \`SCRIPT_TIMEOUT_MS\` | \`5000\` | Script execution timeout in milliseconds |

Example:
\`\`\`bash
ALLOWED_HOSTS=api.github.com,api.example.com docker run --rm -i ${spell.name}
\`\`\`
`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates action-specific execution code.
 * Handles HTTP requests and script execution.
 */
function generateActionCode(action: Action): string {
  if (action.type === 'http') {
    const { url, method, headers, body } = action.config;
    
    // Build fetch options
    const fetchOptions: string[] = [`method: '${method}'`];
    
    // Support {{variable}} interpolation in headers
    if (headers && Object.keys(headers).length > 0) {
      const headersNeedInterpolation = Object.values(headers).some(v => v.includes('{{'));
      if (headersNeedInterpolation) {
        const headerEntries = Object.entries(headers).map(([k, v]) => {
          if (v.includes('{{')) {
            return `'${escapeString(k)}': interpolate(${JSON.stringify(v)}, input)`;
          }
          return `'${escapeString(k)}': ${JSON.stringify(v)}`;
        });
        fetchOptions.push(`headers: {\n      ${headerEntries.join(',\n      ')}\n    }`);
      } else {
        fetchOptions.push(`headers: ${formatJson(headers)}`);
      }
    }
    
    if (body) {
      const bodyCode = body.includes('{{') 
        ? `body: interpolate(${JSON.stringify(body)}, input)`
        : `body: ${JSON.stringify(body)}`;
      fetchOptions.push(bodyCode);
    }
    
    const urlCode = url.includes('{{')
      ? `interpolate('${escapeString(url)}', input)`
      : `'${escapeString(url)}'`;
    
    return `  const timeoutMs = parseInt(process.env.HTTP_TIMEOUT_MS) || 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const targetUrl = ${urlCode};
    
    // Security: Validate URL protocol and host
    const parsedUrl = new URL(targetUrl);
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      throw new Error(\`Protocol not allowed: \${parsedUrl.protocol}. Use http: or https:\`);
    }
    if (!ALLOWED_HOSTS.includes('*') && !ALLOWED_HOSTS.includes(parsedUrl.host)) {
      throw new Error(\`Host not allowed: \${parsedUrl.host}. Allowed: \${ALLOWED_HOSTS.join(', ')}\`);
    }
    
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      ${fetchOptions.join(',\n      ')}
    });
    
    // Check response size before reading
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error(\`Response too large: \${contentLength} bytes (max: \${MAX_RESPONSE_SIZE})\`);
    }
    
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read error body');
      throw new Error(\`HTTP \${response.status} \${response.statusText}: \${errorBody.slice(0, 500)}\`);
    }
    
    const text = await readBodyWithLimit(response, MAX_RESPONSE_SIZE);
    
    try {
      return JSON.parse(text);
    } catch {
      return { data: text };
    }
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(\`Request timed out after \${timeoutMs}ms\`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }`;
  } else {
    // Script action with security warnings
    const { code } = action.config;
    return `  // WARNING: Script runs with full Node.js privileges. Only run trusted code.
  // Consider using vm2 or isolated-vm for untrusted scripts in production.
  const fn = new Function('input', ${JSON.stringify(code)});
  const timeoutMs = parseInt(process.env.SCRIPT_TIMEOUT_MS) || 5000;
  let timeout;

  try {
    const execution = Promise.resolve().then(() => fn(input));
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(\`Script timed out after \${timeoutMs}ms\`)), timeoutMs);
    });
    const result = await Promise.race([execution, timeoutPromise]);
    
    // Ensure result is serializable
    if (result === undefined) {
      return { success: true };
    }
    JSON.stringify(result); // Throws if not serializable
    return result;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(\`Script syntax error: \${err.message}\`);
    }
    throw err;
  } finally {
    if (timeout) clearTimeout(timeout);
  }`;
  }
}

/**
 * Escapes strings for safe embedding in generated code.
 * Prevents code injection vulnerabilities.
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Formats JSON with proper indentation.
 * Used for embedding schemas in generated code.
 * Returns empty object if undefined/null to prevent invalid JS.
 */
function formatJson(obj: any): string {
  if (obj === undefined || obj === null) {
    return '{}';
  }
  return JSON.stringify(obj, null, 2);
}

/**
 * Generates interpolation helper function for server code.
 * Replaces {{variable}} placeholders with input values.
 */
function generateInterpolateFunction(): string {
  return `function interpolate(template, vars) {
  return template.replace(/\\{\\{(\\w+)\\}\\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : '';
  });
}`;
}

/**
 * Checks if a spell needs the interpolation helper function.
 * Returns true if URL, body, or headers contain {{variable}} syntax.
 */
function checkNeedsInterpolation(spell: Spell): boolean {
  if (spell.action.type !== 'http') return false;
  
  const { url, body, headers } = spell.action.config;
  
  if (url.includes('{{')) return true;
  if (body && body.includes('{{')) return true;
  if (headers && Object.values(headers).some(v => v.includes('{{'))) return true;
  
  return false;
}

/**
 * Generates a helper to stream responses with a hard size cap.
 */
function generateReadBodyWithLimitFunction(): string {
  return `async function readBodyWithLimit(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) {
      throw new Error(\`Response too large: \${text.length} bytes (max: \${maxBytes})\`);
    }
    return text;
  }
  
  const decoder = new TextDecoder();
  let chunks = [];
  let total = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel();
      throw new Error(\`Response too large: exceeded \${maxBytes} bytes\`);
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  
  return chunks.join('');
}`;
}
