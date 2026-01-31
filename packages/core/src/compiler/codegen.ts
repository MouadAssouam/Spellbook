/**
 * Spellbook Compiler: Code Generator
 * 
 * Emits JavaScript code from the transformed AST.
 */

import type { SpellAST, ImportNode, ToolNode, ActionNode, MiddlewareNode, AuthNode } from './ast.js';

const ENV_HEADER_PREFIX = '__SPELLBOOK_ENV__:';

// ============================================================================
// Code Generator
// ============================================================================

export interface GeneratedCode {
    'index.js': string;
    'package.json': string;
    'Dockerfile': string;
    'README.md': string;
    'k8s.yaml'?: string;
}

/**
 * Generate code from the AST.
 */
export function generateCode(ast: SpellAST): GeneratedCode {
    return {
        'index.js': generateServerCode(ast),
        'package.json': generatePackageJson(ast),
        'Dockerfile': generateDockerfile(ast),
        'README.md': generateReadme(ast),
        'k8s.yaml': ast.transport.mode === 'sse' ? generateK8sManifest(ast) : undefined,
    };
}

// ============================================================================
// Server Code Generation
// ============================================================================

function generateServerCode(ast: SpellAST): string {
    const sections = [
        generateImports(ast.imports),
        generateHelpers(ast),
        generateValidator(),
        generateServer(ast),
        generateToolHandlers(ast),
        generateTransport(ast),
    ];

    return sections.filter(Boolean).join('\n\n');
}

function generateImports(imports: ImportNode[]): string {
    return imports.map(imp => {
        if (imp.defaultImport && imp.namedImports) {
            return `import ${imp.defaultImport}, { ${imp.namedImports.join(', ')} } from '${imp.module}';`;
        } else if (imp.defaultImport) {
            return `import ${imp.defaultImport} from '${imp.module}';`;
        } else if (imp.namedImports) {
            return `import { ${imp.namedImports.join(', ')} } from '${imp.module}';`;
        }
        return `import '${imp.module}';`;
    }).join('\n');
}

function generateHelpers(ast: SpellAST): string {
    const helpers: string[] = [];
    const hasHttp = ast.tools.some(tool => tool.action.type === 'httpAction');
    const hasEnvHeaders = ast.tools.some(tool =>
        tool.action.type === 'httpAction' &&
        tool.action.headers &&
        Object.values(tool.action.headers).some(value => value.startsWith(ENV_HEADER_PREFIX))
    );
    const needsRetry = ast.tools.some(tool => tool.middleware.some(m => m.name === 'retry'));
    const needsEnvHelper = Boolean(ast.auth) || hasEnvHeaders;
    const authConfig = getAuthConfig(ast.auth);

    // Interpolation helper
    if (ast.metadata?.hasInterpolation) {
        helpers.push(`
function interpolate(template, vars, options = {}) {
  return template.replace(/\\{\\{([\\w.]+)\\}\\}/g, (match, path) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], vars);
    if (value === undefined) {
      console.warn(\`[Spellbook] Interpolation warning: "\${path}" is undefined\`);
      return '';
    }
    return options.encode ? encodeURIComponent(String(value)) : String(value);
  });
}`);
    }

    // Telemetry helper
    const logTarget = ast.transport.mode === 'stdio' ? 'console.error' : 'console.log';
    helpers.push(`
function log(level, event, data = {}) {
  ${logTarget}(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...data }));
}`);

    if (needsEnvHelper) {
        helpers.push(`
function getRequiredEnvValue(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(\`Missing required environment variable: \${name}\`);
  }
  return value;
}`);
    }

    if (authConfig) {
        const schemePrefix = authConfig.scheme ? `'${escapeString(authConfig.scheme)}' + ` : '';
        helpers.push(`
const AUTH_ENV_VAR = '${escapeString(authConfig.envVar)}';

function getAuthHeaderValue() {
  const token = getRequiredEnvValue(AUTH_ENV_VAR);
  return ${schemePrefix}token;
}`);
    }

    if (hasHttp) {
        helpers.push(`
const ALLOWED_HOSTS = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',').map(h => h.trim())
  : ['*'];
const MAX_RESPONSE_SIZE = parseInt(process.env.MAX_RESPONSE_SIZE) || 10 * 1024 * 1024;
const DEFAULT_HTTP_TIMEOUT_MS = parseInt(process.env.HTTP_TIMEOUT_MS) || 15000;

async function readBodyWithLimit(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (text.length > maxBytes) {
      throw new Error(\`Response too large: \${text.length} bytes (max: \${maxBytes})\`);
    }
    return text;
  }
  
  const decoder = new TextDecoder();
  const chunks = [];
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
}`);
    }

    if (needsRetry) {
        helpers.push(`
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(fn, options) {
  const { maxAttempts, baseDelay, maxDelay } = options;
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt >= maxAttempts) throw error;
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = Math.floor(Math.random() * 100);
      await sleep(delay + jitter);
    }
  }
}`);
    }

    return helpers.join('\n');
}

function generateValidator(): string {
    return `
const ajv = new Ajv({ allErrors: true });

function validate(schema, data) {
  const validator = ajv.compile(schema);
  if (!validator(data)) {
    throw new Error(\`Validation failed: \${ajv.errorsText(validator.errors)}\`);
  }
  return data;
}`;
}

function generateServer(ast: SpellAST): string {
    const toolsList = ast.tools.map(t =>
        `    { name: '${t.name}', description: '${escapeString(t.description)}', inputSchema: ${JSON.stringify(t.inputSchema.jsonSchema)} }`
    ).join(',\n');

    return `
const server = new Server(
  { name: '${ast.name}', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
${toolsList}
  ]
}));`;
}

function generateToolHandlers(ast: SpellAST): string {
    const cases = ast.tools.map(tool => {
        const handler = generateActionHandler(tool, ast.auth);
        const telemetry = tool.middleware.find(m => m.name === 'telemetry');
        const telemetryEnabled = Boolean(telemetry);
        const logLevel = typeof telemetry?.config?.logLevel === 'string' ? telemetry.config.logLevel : 'info';
        const includeInput = telemetry?.config?.includeInput === true;
        const includeDuration = telemetry?.config?.includeDuration !== false;

        const invokeLog = telemetryEnabled
            ? `      log('${logLevel}', 'tool_invoked', { tool: '${tool.name}'${includeInput ? ', input' : ''} });\n`
            : '';
        const completeLog = telemetryEnabled
            ? `        log('${logLevel}', 'tool_completed', { tool: '${tool.name}'${includeDuration ? ', duration_ms: Date.now() - startTime' : ''} });\n`
            : '';
        const errorLog = telemetryEnabled
            ? `        log('error', 'tool_failed', { tool: '${tool.name}', error: error.message${includeDuration ? ', duration_ms: Date.now() - startTime' : ''} });\n`
            : '';

        const outputSchema = JSON.stringify(tool.outputSchema.jsonSchema);
        const hasOutputSchema = Object.keys(tool.outputSchema.jsonSchema || {}).length > 0;
        const outputValidation = hasOutputSchema
            ? `        validate(${outputSchema}, result);\n`
            : '';
        return `    case '${tool.name}':
${invokeLog}      ${telemetryEnabled && includeDuration ? 'const startTime = Date.now();\n' : ''}
      try {
        validate(${JSON.stringify(tool.inputSchema.jsonSchema)}, input);
${handler}
${outputValidation}
${completeLog}
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
${errorLog}
        throw error;
      }`;
    }).join('\n');

    return `
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: input } = request.params;
  
  switch (name) {
${cases}
    default:
      throw new Error(\`Unknown tool: \${name}\`);
  }
});`;
}

function generateActionHandler(tool: ToolNode, auth?: AuthNode): string {
    const action = tool.action;

    if (action.type === 'httpAction') {
        return generateHttpHandler(action, tool, auth);
    } else {
        return generateScriptHandler(action);
    }
}

function generateHttpHandler(
    action: Extract<ActionNode, { type: 'httpAction' }>,
    tool: ToolNode,
    auth?: AuthNode
): string {
    const urlCode = action.hasInterpolation
        ? `interpolate('${escapeString(action.url)}', input, { encode: true })`
        : `'${escapeString(action.url)}'`;

    const authConfig = getAuthConfig(auth);
    const authHeaderEntry = authConfig
        ? `'${escapeString(authConfig.headerKey)}': getAuthHeaderValue()`
        : null;

    const headerEntries = [];
    if (authHeaderEntry) headerEntries.push(authHeaderEntry);

    if (action.headers) {
        for (const [key, value] of Object.entries(action.headers)) {
            const escapedKey = escapeString(key);
            if (value.startsWith(ENV_HEADER_PREFIX)) {
                const envVar = value.slice(ENV_HEADER_PREFIX.length);
                headerEntries.push(`'${escapedKey}': getRequiredEnvValue('${escapeString(envVar)}')`);
                continue;
            }
            if (value.includes('{{')) {
                headerEntries.push(`'${escapedKey}': interpolate(${JSON.stringify(value)}, input)`);
                continue;
            }
            headerEntries.push(`'${escapedKey}': ${JSON.stringify(value)}`);
        }
    }

    const headersCode = headerEntries.length
        ? `headers: {\n          ${headerEntries.join(',\n          ')}\n        },`
        : '';

    const bodyCode = action.body
        ? (action.body.includes('{{')
            ? `body: interpolate(${JSON.stringify(action.body)}, input),`
            : `body: ${JSON.stringify(action.body)},`)
        : '';

    const retryConfig = tool.middleware.find(m => m.name === 'retry')?.config as {
        maxAttempts?: number;
        baseDelay?: number;
        maxDelay?: number;
    } | undefined;
    const timeoutConfig = tool.middleware.find(m => m.name === 'timeout')?.config as {
        ms?: number;
    } | undefined;

    const timeoutExpr = typeof timeoutConfig?.ms === 'number'
        ? String(timeoutConfig.ms)
        : 'DEFAULT_HTTP_TIMEOUT_MS';
    const retryAttempts = retryConfig?.maxAttempts ?? 1;
    const baseDelay = retryConfig?.baseDelay ?? 1000;
    const maxDelay = retryConfig?.maxDelay ?? 10000;
    const useRetry = retryAttempts > 1;

    const requestCall = useRetry
        ? `await retry(executeRequest, { maxAttempts: ${retryAttempts}, baseDelay: ${baseDelay}, maxDelay: ${maxDelay} })`
        : 'await executeRequest()';

    return `        const timeoutMs = ${timeoutExpr};
        const executeRequest = async () => {
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

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const response = await fetch(targetUrl, {
              signal: controller.signal,
              method: '${action.method}',
              ${headersCode}
              ${bodyCode}
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
          }
        };

        const result = ${requestCall};`;
}

function generateScriptHandler(action: Extract<ActionNode, { type: 'scriptAction' }>): string {
    if (action.execution === 'isolated') {
        return `        const memoryLimit = parseInt(process.env.SANDBOX_MEMORY_MB) || 32;
        const isolate = new ivm.Isolate({ memoryLimit });
        const context = isolate.createContextSync();
        const jail = context.global;
        jail.setSync('input', new ivm.ExternalCopy(input).copyInto());
        jail.setSync('__result', undefined);
        const code = \`__result = (function(input) { ${escapeString(action.code)} })(input);\`;
        const script = isolate.compileScriptSync(code);
        const timeoutMs = parseInt(process.env.SCRIPT_TIMEOUT_MS) || 5000;
        await script.run(context, { timeout: timeoutMs });
        const result = jail.getSync('__result')?.copy?.() ?? jail.getSync('__result');
        isolate.dispose();`;
    } else {
        return `        const fn = new Function('input', \`${escapeString(action.code)}\`);
        const result = fn(input);`;
    }
}

function generateTransport(ast: SpellAST): string {
    if (ast.transport.mode === 'sse') {
        return `
const app = express();
app.use(express.json());

const serverStartTime = Date.now();

app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const maxMemory = parseInt(process.env.MAX_MEMORY_MB) || 256;
  const memoryOk = memUsage.heapUsed < maxMemory * 1024 * 1024;
  res.status(memoryOk ? 200 : 503).json({
    status: memoryOk ? 'healthy' : 'degraded',
    checks: {
      memory: { status: memoryOk ? 'pass' : 'fail', used_mb: Math.round(memUsage.heapUsed / 1024 / 1024) },
      uptime: { status: 'pass', seconds: Math.round((Date.now() - serverStartTime) / 1000) }
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req, res) => res.json({ ready: true, timestamp: new Date().toISOString() }));

const transports = {};
app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on('close', () => delete transports[transport.sessionId]);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  const transport = transports[req.query.sessionId];
  if (!transport) return res.status(400).send('Invalid session');
  await transport.handlePostMessage(req, res, req.body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log('info', 'server_started', { port: PORT, transport: 'sse' });
  console.log(\` ${ast.name} running on port \${PORT}\`);
});`;
    } else {
        return `
const transport = new StdioServerTransport();
log('info', 'server_started', { transport: 'stdio' });
await server.connect(transport);`;
    }
}

// ============================================================================
// Package.json Generation
// ============================================================================

function generatePackageJson(ast: SpellAST): string {
    const hasIsolated = ast.tools.some(t =>
        t.action.type === 'scriptAction' && t.action.execution === 'isolated'
    );

    const deps: Record<string, string> = {
        '@modelcontextprotocol/sdk': '^1.0.0',
        'ajv': '^8.12.0',
        'zod': '^3.22.0',
    };

    if (ast.transport.mode === 'sse') {
        deps['express'] = '^4.18.0';
    }

    if (hasIsolated) {
        deps['isolated-vm'] = '^4.6.0';
    }

    return JSON.stringify({
        name: ast.name,
        version: '1.0.0',
        type: 'module',
        main: 'index.js',
        scripts: {
            start: 'node index.js',
            dev: 'node --watch index.js',
        },
        dependencies: deps,
    }, null, 2);
}

// ============================================================================
// Dockerfile Generation
// ============================================================================

function generateDockerfile(ast: SpellAST): string {
    const hasIsolated = ast.tools.some(t =>
        t.action.type === 'scriptAction' && t.action.execution === 'isolated'
    );
    const hasSse = ast.transport.mode === 'sse';

    return `# Production Dockerfile for ${ast.name}
# Generated by Spellbook AST Compiler

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY . .

FROM node:20-alpine
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/*.js ./
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
USER nodejs
${hasSse ? 'EXPOSE 3000' : ''}
ENV NODE_ENV=production PORT=3000 LOG_LEVEL=info${hasIsolated ? ' SANDBOX_MEMORY_MB=32' : ''}
${hasSse ? 'HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\\\\n  CMD wget -qO- http://localhost:3000/health || exit 1' : ''}
CMD ["node", "index.js"]`;
}

// ============================================================================
// README Generation
// ============================================================================

function generateReadme(ast: SpellAST): string {
    const toolDocs = ast.tools.map(t => `### ${t.name}\n${t.description}`).join('\n\n');

    return `# ${ast.name}

${ast.description}

## Generated by Spellbook AST Compiler

## Tools

${toolDocs}

## Quick Start

\`\`\`bash
npm install
npm start
\`\`\`

## Docker

\`\`\`bash
docker build -t ${ast.name} .
docker run -p 3000:3000 ${ast.name}
\`\`\`
`;
}

// ============================================================================
// K8s Manifest Generation
// ============================================================================

function generateK8sManifest(ast: SpellAST): string {
    return `# Kubernetes manifests for ${ast.name}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${ast.name}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${ast.name}
  template:
    metadata:
      labels:
        app: ${ast.name}
    spec:
      containers:
      - name: server
        image: ${ast.name}:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: ${ast.name}
spec:
  selector:
    app: ${ast.name}
  ports:
  - port: 80
    targetPort: 3000`;
}

// ============================================================================
// Helpers
// ============================================================================

function getAuthConfig(auth?: AuthNode): { envVar: string; headerKey: string; scheme: string } | null {
    if (!auth || auth.authType === 'none') return null;

    if (auth.authType === 'oauth2') {
        const config = auth.config as { tokenEnvVar?: string };
        return {
            envVar: config.tokenEnvVar || 'MCP_ACCESS_TOKEN',
            headerKey: 'Authorization',
            scheme: 'Bearer ',
        };
    }

    if (auth.authType === 'bearer') {
        const config = auth.config as { envVar: string };
        return {
            envVar: config.envVar,
            headerKey: 'Authorization',
            scheme: 'Bearer ',
        };
    }

    if (auth.authType === 'apiKey') {
        const config = auth.config as { envVar: string; headerKey?: string };
        return {
            envVar: config.envVar,
            headerKey: config.headerKey || 'x-api-key',
            scheme: '',
        };
    }

    return null;
}

function escapeString(str: string): string {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}
