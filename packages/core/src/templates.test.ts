// kiro-generated
/**
 * Property-based tests for template system
 * 
 * Uses fast-check to verify correctness properties across random inputs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { templates } from './templates.js';
import type { Spell, HTTPConfig, ScriptConfig } from './types.js';

// ============================================================================
// Arbitraries (Generators for property-based testing)
// ============================================================================

/**
 * Generates valid spell names (kebab-case, 3-50 chars)
 */
const spellNameArb = fc.stringMatching(/^[a-zA-Z0-9-]{3,50}$/);

/**
 * Generates valid descriptions (100-500 chars)
 */
const descriptionArb = fc.string({ minLength: 100, maxLength: 500 });

/**
 * Generates valid JSON schemas
 */
const jsonSchemaArb = fc.record({
  type: fc.constant('object'),
  properties: fc.dictionary(
    fc.string(),
    fc.record({
      type: fc.constantFrom('string', 'number', 'boolean', 'object', 'array')
    })
  )
});

/**
 * Generates HTTP action configurations
 */
const httpConfigArb: fc.Arbitrary<HTTPConfig> = fc.record({
  url: fc.webUrl(),
  method: fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
  headers: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
  body: fc.option(fc.string(), { nil: undefined })
});

/**
 * Generates script action configurations
 */
const scriptConfigArb: fc.Arbitrary<ScriptConfig> = fc.record({
  runtime: fc.constant('node' as const),
  code: fc.string({ minLength: 1 })
});

/**
 * Generates complete spell definitions
 */
const spellArb: fc.Arbitrary<Spell> = fc.record({
  id: fc.uuid(),
  name: spellNameArb,
  description: descriptionArb,
  inputSchema: jsonSchemaArb,
  outputSchema: jsonSchemaArb,
  action: fc.oneof(
    fc.record({ type: fc.constant('http' as const), config: httpConfigArb }),
    fc.record({ type: fc.constant('script' as const), config: scriptConfigArb })
  )
});

// ============================================================================
// Property 2: Valid Dockerfile syntax
// ============================================================================

describe('Dockerfile template', () => {
  it('Property 2: Valid Dockerfile syntax - contains required directives', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        const dockerfile = templates.dockerfile(spell);
        
        // Must contain required directives
        expect(dockerfile).toContain('FROM node:20-alpine');
        expect(dockerfile).toContain('WORKDIR /app');
        expect(dockerfile).toContain('COPY package.json ./');
        expect(dockerfile).toContain('RUN npm install --omit=dev');
        expect(dockerfile).toContain('COPY . .');
        expect(dockerfile).toContain('CMD ["node", "index.js"]');
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 3: Valid package.json structure
// ============================================================================

describe('package.json template', () => {
  it('Property 3: Valid package.json structure - valid JSON with required fields', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        const pkgJson = templates.packageJson(spell);
        
        // Must be valid JSON
        const pkg = JSON.parse(pkgJson);
        
        // Must have required fields
        expect(pkg.name).toBe(`spell-${spell.name}`);
        expect(pkg.version).toBe('1.0.0');
        expect(pkg.type).toBe('module');
        expect(pkg.main).toBe('index.js');
        
        // Must have required dependencies
        expect(pkg.dependencies).toHaveProperty('@modelcontextprotocol/sdk');
        expect(pkg.dependencies).toHaveProperty('ajv');
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 4: Valid server code syntax
// ============================================================================

describe('Server code template', () => {
  it('Property 4: Valid server code syntax - contains MCP protocol implementation', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        const code = templates.serverCode(spell);
        
        // Must contain MCP SDK imports
        expect(code).toContain("import { Server } from '@modelcontextprotocol/sdk/server/index.js'");
        expect(code).toContain("import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'");
        expect(code).toContain('CallToolRequestSchema');
        expect(code).toContain('ListToolsRequestSchema');
        
        // Must contain server initialization
        expect(code).toContain('const server = new Server');
        
        // Must contain request handlers
        expect(code).toContain('server.setRequestHandler(ListToolsRequestSchema');
        expect(code).toContain('server.setRequestHandler(CallToolRequestSchema');
        
        // Must contain transport setup
        expect(code).toContain('const transport = new StdioServerTransport()');
        expect(code).toContain('await server.connect(transport)');
        
        // Must contain spell name (description may be escaped, so we don't check it directly)
        expect(code).toContain(spell.name);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 5: Action type handling
// ============================================================================

describe('Action type handling', () => {
  it('Property 5: HTTP actions generate fetch code', () => {
    const httpSpellArb = fc.record({
      id: fc.uuid(),
      name: spellNameArb,
      description: descriptionArb,
      inputSchema: jsonSchemaArb,
      outputSchema: jsonSchemaArb,
      action: fc.record({ 
        type: fc.constant('http' as const), 
        config: httpConfigArb 
      })
    });
    
    fc.assert(
      fc.property(httpSpellArb, (spell) => {
        const code = templates.serverCode(spell);
        
        // HTTP actions must generate fetch code
        expect(code).toContain('await fetch(');
        expect(code).toContain(`method: '${spell.action.config.method}'`);
      }),
      { numRuns: 100 }
    );
  });
  
  it('Property 5: Script actions generate execution code', () => {
    const scriptSpellArb = fc.record({
      id: fc.uuid(),
      name: spellNameArb,
      description: descriptionArb,
      inputSchema: jsonSchemaArb,
      outputSchema: jsonSchemaArb,
      action: fc.record({ 
        type: fc.constant('script' as const), 
        config: scriptConfigArb 
      })
    });
    
    fc.assert(
      fc.property(scriptSpellArb, (spell) => {
        const code = templates.serverCode(spell);
        
        // Script actions must generate Function execution code
        expect(code).toContain('new Function');
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 6: HTTP configuration completeness
// ============================================================================

describe('HTTP configuration completeness', () => {
  it('Property 6: Headers included when present', () => {
    const httpWithHeadersArb = fc.record({
      id: fc.uuid(),
      name: spellNameArb,
      description: descriptionArb,
      inputSchema: jsonSchemaArb,
      outputSchema: jsonSchemaArb,
      action: fc.record({ 
        type: fc.constant('http' as const), 
        config: fc.record({
          url: fc.webUrl(),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
          headers: fc.dictionary(fc.string(), fc.string(), { minKeys: 1 }),
          body: fc.option(fc.string(), { nil: undefined })
        })
      })
    });
    
    fc.assert(
      fc.property(httpWithHeadersArb, (spell) => {
        const code = templates.serverCode(spell);
        
        // Must include headers in fetch call
        expect(code).toContain('headers:');
      }),
      { numRuns: 100 }
    );
  });
  
  it('Property 6: Body included when present', () => {
    const httpWithBodyArb = fc.record({
      id: fc.uuid(),
      name: spellNameArb,
      description: descriptionArb,
      inputSchema: jsonSchemaArb,
      outputSchema: jsonSchemaArb,
      action: fc.record({ 
        type: fc.constant('http' as const), 
        config: fc.record({
          url: fc.webUrl(),
          method: fc.constantFrom('POST', 'PUT', 'PATCH'),
          headers: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
          body: fc.string({ minLength: 1 })
        })
      })
    });
    
    fc.assert(
      fc.property(httpWithBodyArb, (spell) => {
        const code = templates.serverCode(spell);
        
        // Must include body in fetch call
        expect(code).toContain('body:');
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 8: Template interpolation support
// ============================================================================

describe('Template interpolation support', () => {
  it('Property 8: Interpolation function included when URL has placeholders', () => {
    const httpWithInterpolationArb = fc.record({
      id: fc.uuid(),
      name: spellNameArb,
      description: descriptionArb,
      inputSchema: jsonSchemaArb,
      outputSchema: jsonSchemaArb,
      action: fc.record({ 
        type: fc.constant('http' as const), 
        config: fc.record({
          url: fc.constant('https://api.example.com/{{resource}}/{{id}}'),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
          headers: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
          body: fc.option(fc.string(), { nil: undefined })
        })
      })
    });
    
    fc.assert(
      fc.property(httpWithInterpolationArb, (spell) => {
        const code = templates.serverCode(spell);
        
        // Must include interpolate function
        expect(code).toContain('function interpolate');
        expect(code).toContain('interpolate(');
      }),
      { numRuns: 100 }
    );
  });
  
  it('Property 8: Interpolation function included when body has placeholders', () => {
    const httpWithBodyInterpolationArb = fc.record({
      id: fc.uuid(),
      name: spellNameArb,
      description: descriptionArb,
      inputSchema: jsonSchemaArb,
      outputSchema: jsonSchemaArb,
      action: fc.record({ 
        type: fc.constant('http' as const), 
        config: fc.record({
          url: fc.webUrl(),
          method: fc.constantFrom('POST', 'PUT', 'PATCH'),
          headers: fc.option(fc.dictionary(fc.string(), fc.string()), { nil: undefined }),
          body: fc.constant('{"name": "{{name}}", "value": "{{value}}"}')
        })
      })
    });
    
    fc.assert(
      fc.property(httpWithBodyInterpolationArb, (spell) => {
        const code = templates.serverCode(spell);
        
        // Must include interpolate function
        expect(code).toContain('function interpolate');
        expect(code).toContain('interpolate(');
      }),
      { numRuns: 100 }
    );
  });
  
  it('Property 8: Interpolation function included when headers have placeholders', () => {
    const httpWithHeaderInterpolationArb = fc.record({
      id: fc.uuid(),
      name: spellNameArb,
      description: descriptionArb,
      inputSchema: jsonSchemaArb,
      outputSchema: jsonSchemaArb,
      action: fc.record({ 
        type: fc.constant('http' as const), 
        config: fc.record({
          url: fc.webUrl(),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
          headers: fc.constant({ 'Authorization': 'Bearer {{token}}', 'Content-Type': 'application/json' }),
          body: fc.option(fc.string(), { nil: undefined })
        })
      })
    });
    
    fc.assert(
      fc.property(httpWithHeaderInterpolationArb, (spell) => {
        const code = templates.serverCode(spell);
        
        // Must include interpolate function
        expect(code).toContain('function interpolate');
        // Must interpolate the header with placeholder
        expect(code).toContain("interpolate(\"Bearer {{token}}\"");
        // Static header should not be interpolated
        expect(code).toContain("'Content-Type': \"application/json\"");
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 7: README completeness
// ============================================================================

describe('README template', () => {
  it('Property 7: README completeness - contains all required sections', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        const readme = templates.readme(spell);
        
        // Must contain spell name as title
        expect(readme).toContain(`# ${spell.name}`);
        
        // Must contain description
        expect(readme).toContain(spell.description);
        
        // Must contain Docker build instructions
        expect(readme).toContain('docker build');
        expect(readme).toContain(`-t ${spell.name}`);
        
        // Must contain mcp.json configuration example
        expect(readme).toContain('.kiro/settings/mcp.json');
        expect(readme).toContain('mcpServers');
        expect(readme).toContain(spell.name);
        
        // Must contain input schema
        expect(readme).toContain('Input Schema');
        expect(readme).toContain(JSON.stringify(spell.inputSchema, null, 2));
        
        // Must contain output schema
        expect(readme).toContain('Output Schema');
        expect(readme).toContain(JSON.stringify(spell.outputSchema, null, 2));
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 1: Template determinism
// ============================================================================

describe('Template determinism', () => {
  it('Property 1: Same spell produces identical output', () => {
    fc.assert(
      fc.property(spellArb, (spell) => {
        // Call each template twice with the same spell
        const dockerfile1 = templates.dockerfile(spell);
        const dockerfile2 = templates.dockerfile(spell);
        expect(dockerfile1).toBe(dockerfile2);
        
        const pkg1 = templates.packageJson(spell);
        const pkg2 = templates.packageJson(spell);
        expect(pkg1).toBe(pkg2);
        
        const code1 = templates.serverCode(spell);
        const code2 = templates.serverCode(spell);
        expect(code1).toBe(code2);
        
        const readme1 = templates.readme(spell);
        const readme2 = templates.readme(spell);
        expect(readme1).toBe(readme2);
      }),
      { numRuns: 100 }
    );
  });
});
