
import { Spell, ToolDefinition } from './types.js';
import { randomUUID } from 'crypto';

export interface OpenAPITool {
    name: string;
    operationId: string;
    summary: string;
    description: string;
    method: string;
    path: string;
    url: string;
}

export interface ParsedOpenAPISpec {
    apiName: string;
    suggestedName: string;
    description: string;
    version: string;
    endpoints: any[];
    tools: OpenAPITool[];
    auth?: {
        type: 'apiKey' | 'bearer' | 'oauth2';
        description?: string;
    };
}

export function parseOpenApiSpec(specText: string): ParsedOpenAPISpec {
    let spec: any;

    try {
        spec = JSON.parse(specText);
    } catch {
        spec = parseBasicYaml(specText);
    }

    const spell = parseOpenAPI(spec);
    const title = spec.info?.title || 'API';
    const apiName = title.replace(/-/g, ' ');
    const suggestedName = spell.name;

    // Convert spell tools to OpenAPITool format
    const tools: OpenAPITool[] = spell.tools.map(tool => ({
        name: tool.name,
        operationId: tool.name,
        summary: tool.description.split('.')[0],
        description: tool.description,
        method: (tool.action.config as any).method || 'GET',
        path: ((tool.action.config as any).url as string).replace(/https?:\/\/[^\/]+/, ''),
        url: (tool.action.config as any).url as string
    }));

    return {
        apiName: apiName.charAt(0).toUpperCase() + apiName.slice(1),
        suggestedName,
        description: spell.description,
        version: spec.info?.version || '1.0.0',
        endpoints: [],
        tools,
        auth: detectAuth(spec)
    };
}

function detectAuth(spec: any): ParsedOpenAPISpec['auth'] {
    // OpenAPI 3.x
    if (spec.openapi) {
        const securitySchemes = spec.components?.securitySchemes || {};
        const globalSecurity = spec.security?.[0];

        if (globalSecurity) {
            const schemeName = Object.keys(globalSecurity)[0];
            const scheme = securitySchemes[schemeName];

            if (scheme) {
                if (scheme.type === 'apiKey') {
                    return { type: 'apiKey', description: scheme.description };
                } else if (scheme.type === 'http' && scheme.scheme === 'bearer') {
                    return { type: 'bearer', description: scheme.description };
                } else if (scheme.type === 'oauth2') {
                    return { type: 'oauth2', description: scheme.description };
                }
            }
        }
    }

    // Swagger 2.0
    if (spec.swagger) {
        const securityDefs = spec.securityDefinitions;
        if (securityDefs) {
            const hasBearer = Object.values(securityDefs).some((s: any) => s.type === 'apiKey' && s.in === 'header');
            if (hasBearer) {
                return { type: 'apiKey', description: 'API Key authentication' };
            }
        }
    }

    return undefined;
}

function parseBasicYaml(yamlText: string): any {
    const lines = yamlText.split('\n');
    const result: any = {};
    const stack: Array<{ obj: any; level: number }> = [{ obj: result, level: -1 }];

    for (const line of lines) {
        if (line.trim().startsWith('#')) continue;

        const indent = line.search(/\S|$/);
        const trimmed = line.trim();
        if (!trimmed) continue;

        while (stack.length > 1 && stack[stack.length - 1].level >= indent) {
            stack.pop();
        }

        const current = stack[stack.length - 1].obj;

        if (trimmed.includes(':')) {
            const colonIndex = trimmed.indexOf(':');
            const key = trimmed.substring(0, colonIndex).trim().replace(/^["']|["']$/g, '');
            const value = trimmed.substring(colonIndex + 1).trim();

            if (value === '' || value === '|') {
                current[key] = {};
                stack.push({ obj: current[key], level: indent });
            } else if (value.startsWith('-')) {
                current[key] = [value.substring(1).trim()];
            } else {
                current[key] = parseYamlValue(value);
            }
        } else if (trimmed.startsWith('- ')) {
            const itemValue = trimmed.substring(2).trim();
            if (Array.isArray(current)) {
                current.push(parseYamlValue(itemValue));
            }
        }
    }

    return result;
}

function parseYamlValue(value: string): any {
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }

    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;

    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

    return value;
}

export function parseOpenAPI(spec: any): Spell {
    if (!spec || typeof spec !== 'object') {
        throw new Error('Invalid OpenAPI specification: must be an object');
    }

    // Basic version check (supports 3.x and 2.x/Swagger ideally, but focused on 3.x structure)
    if (!spec.openapi && !spec.swagger) {
        throw new Error('Invalid OpenAPI spec: missing "openapi" or "swagger" version field');
    }

    const tools: ToolDefinition[] = [];

    // extract base URL
    let serverUrl = 'https://api.example.com';
    if (spec.servers && spec.servers.length > 0) {
        serverUrl = spec.servers[0].url;
    } else if (spec.host) {
        // Swagger 2.0
        const scheme = (spec.schemes && spec.schemes[0]) || 'https';
        const basePath = spec.basePath || '';
        serverUrl = `${scheme}://${spec.host}${basePath}`;
    }

    if (!spec.paths) {
        throw new Error('Invalid OpenAPI spec: missing "paths"');
    }

    for (const [path, pathItem] of Object.entries(spec.paths)) {
        if (!pathItem || typeof pathItem !== 'object') continue;

        // Iterate over HTTP methods
        const methods = ['get', 'post', 'put', 'delete', 'patch'];
        for (const method of methods) {
            if (!(method in pathItem)) continue;

            const op = (pathItem as any)[method];
            if (!op) continue;

            // Generate a tool name from operationId or path
            let toolName = op.operationId;
            if (!toolName) {
                // Fallback: verb-resource (e.g., get-users)
                const pathParts = path.split('/').filter(p => p && !p.startsWith('{'));
                const resource = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'root';
                toolName = `${method}-${resource}`;
            }

            // Normalize tool name (lowercase, kebab-case)
            toolName = toolName
                .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase to kebab-case
                .replace(/[^a-zA-Z0-9-]/g, '-')
                .toLowerCase()
                .replace(/^-+|-+$/g, '');

            // Build parameters
            const parameters = [
                ...(op.parameters || []),
                ...((pathItem as any).parameters || []) // Path-level parameters
            ];

            const properties: Record<string, any> = {};
            const requiredParams: string[] = [];

            for (const param of parameters) {
                if (!param.name) continue;

                // Determine type
                const schema = param.schema || param; // Swagger 2.0 vs OpenAPI 3.0
                const type = schema.type || 'string';

                properties[param.name] = { type };
                if (param.required) {
                    requiredParams.push(param.name);
                }
            }

            // Convert OpenAPI path parameters {param} to Spellbook syntax {{param}}
            let processedUrl = path.replace(/\{([^}]+)\}/g, '{{$1}}');

            // Ensure absolute URL
            const fullUrl = serverUrl.endsWith('/') && processedUrl.startsWith('/')
                ? serverUrl + processedUrl.slice(1)
                : !serverUrl.endsWith('/') && !processedUrl.startsWith('/')
                    ? serverUrl + '/' + processedUrl
                    : serverUrl + processedUrl;


            let description = op.summary || op.description || `Performs ${method.toUpperCase()} request to ${path}`;
            if (description.length < 100) {
                description += ' - ' + `This tool performs a ${method.toUpperCase()} request to ${path}. It was automatically generated from an OpenAPI specification. See the input schema for required parameters.`;
                if (description.length < 100) description = description.padEnd(100, '.');
            }

            tools.push({
                name: toolName,
                description,
                inputSchema: {
                    type: 'object',
                    properties,
                    required: requiredParams
                },
                outputSchema: { type: 'object' }, // Generic output schema for now
                action: {
                    type: 'http',
                    config: {
                        url: fullUrl,
                        method: method.toUpperCase() as any
                    }
                }
            });
        }
    }

    if (tools.length === 0) {
        throw new Error('No valid operations found in OpenAPI spec');
    }

    const title = spec.info?.title || 'openapi-server';
    const serverName = title.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase().substring(0, 50);

    let description = spec.info?.description || `MCP server generated from ${title} OpenAPI spec`;
    if (description.length < 100) {
        description += ' - This server was automatically generated from an OpenAPI specification by the Spellbook MCP tool. It provides access to the API defined in the spec.';
        if (description.length < 100) description = description.padEnd(100, '.');
    }

    return {
        id: randomUUID(),
        name: serverName,
        description,
        transport: 'stdio',
        tools
    };
}
