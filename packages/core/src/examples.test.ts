// kiro-generated
/**
 * Example Spells Integration Tests
 * 
 * Tests the generator with real example spells to verify
 * the complete generation pipeline produces valid output.
 * 
 * **Feature: milestone-6-example**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateMCPServer } from './generator.js';
import { SpellSchema, type Spell } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get directory path for loading example files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const examplesDir = path.join(__dirname, '../../../examples');

// Load example spell from JSON file
function loadExample(filename: string): Spell {
  const filePath = path.join(examplesDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Spell;
}

// All example spells for property testing
const exampleSpells: Spell[] = [
  loadExample('github-fetcher.json'),
  loadExample('weather-api.json'),
  loadExample('calculator.json')
];

// ============================================================================
// Property Tests
// ============================================================================

describe('Example Spells - Property Tests', () => {
  /**
   * **Feature: milestone-6-example, Property 1: Generator produces complete file bundles**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   */
  it('Property 1: Generator produces complete file bundles', () => {
    for (const spell of exampleSpells) {
      const files = generateMCPServer(spell);
      const keys = Object.keys(files);
      
      expect(keys).toHaveLength(4);
      expect(keys).toContain('Dockerfile');
      expect(keys).toContain('package.json');
      expect(keys).toContain('index.js');
      expect(keys).toContain('README.md');
    }
  });

  /**
   * **Feature: milestone-6-example, Property 2: Generated package.json is valid JSON with required dependencies**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  it('Property 2: Generated package.json is valid JSON with required dependencies', () => {
    for (const spell of exampleSpells) {
      const files = generateMCPServer(spell);
      const pkg = JSON.parse(files['package.json']);
      
      expect(pkg.dependencies).toBeDefined();
      expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
      expect(pkg.dependencies['ajv']).toBeDefined();
      expect(pkg.type).toBe('module');
    }
  });

  /**
   * **Feature: milestone-6-example, Property 3: Generated Dockerfile follows Node.js best practices**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  it('Property 3: Generated Dockerfile follows Node.js best practices', () => {
    for (const spell of exampleSpells) {
      const files = generateMCPServer(spell);
      const dockerfile = files['Dockerfile'];
      
      expect(dockerfile).toContain('FROM node:20-alpine');
      expect(dockerfile).toContain('WORKDIR');
      expect(dockerfile).toContain('COPY package');
      expect(dockerfile).toContain('npm install');
    }
  });

  /**
   * **Feature: milestone-6-example, Property 4: Generated server code is syntactically valid JavaScript**
   * **Validates: Requirements 4.1**
   */
  it('Property 4: Generated server code is syntactically valid JavaScript', () => {
    for (const spell of exampleSpells) {
      const files = generateMCPServer(spell);
      const serverCode = files['index.js'];
      
      // Check for basic JS structure - imports, server setup, handlers
      expect(serverCode).toContain('import {');
      expect(serverCode).toContain('const server = new Server');
      expect(serverCode).toContain('server.setRequestHandler');
      expect(serverCode).toContain('await server.connect');
    }
  });

  /**
   * **Feature: milestone-6-example, Property 5: HTTP action spells include fetch implementation**
   * **Validates: Requirements 4.2**
   */
  it('Property 5: HTTP action spells include fetch implementation', () => {
    const httpSpells = exampleSpells.filter(s => s.action.type === 'http');
    
    for (const spell of httpSpells) {
      const files = generateMCPServer(spell);
      const serverCode = files['index.js'];
      
      expect(serverCode).toContain('fetch(');
      expect(serverCode).toContain('response.ok');
      expect(serverCode).toContain('JSON.parse(text)');
    }
  });

  /**
   * **Feature: milestone-6-example, Property 6: Script action spells include Function constructor**
   * **Validates: Requirements 4.3**
   */
  it('Property 6: Script action spells include Function constructor', () => {
    const scriptSpells = exampleSpells.filter(s => s.action.type === 'script');
    
    for (const spell of scriptSpells) {
      const files = generateMCPServer(spell);
      const serverCode = files['index.js'];
      
      expect(serverCode).toContain('new Function');
    }
  });

  /**
   * **Feature: milestone-6-example, Property 7: URL interpolation is included when needed**
   * **Validates: Requirements 4.4**
   */
  it('Property 7: URL interpolation is included when needed', () => {
    const spellsWithInterpolation = exampleSpells.filter(s => 
      s.action.type === 'http' && s.action.config.url.includes('{{')
    );
    
    for (const spell of spellsWithInterpolation) {
      const files = generateMCPServer(spell);
      const serverCode = files['index.js'];
      
      expect(serverCode).toContain('function interpolate');
      expect(serverCode).toContain('interpolate(');
    }
  });

  /**
   * **Feature: milestone-6-example, Property 8: README contains required documentation sections**
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
   */
  it('Property 8: README contains required documentation sections', () => {
    for (const spell of exampleSpells) {
      const files = generateMCPServer(spell);
      const readme = files['README.md'];
      
      // Title with spell name
      expect(readme).toContain(`# ${spell.name}`);
      // Description
      expect(readme).toContain(spell.description);
      // Docker build instructions
      expect(readme).toContain('docker build');
      // mcp.json configuration
      expect(readme).toContain('mcp.json');
      expect(readme).toContain('mcpServers');
      // Schema documentation
      expect(readme).toContain('Input Schema');
      expect(readme).toContain('Output Schema');
    }
  });

  /**
   * **Feature: milestone-6-example, Property 9: Example spells round-trip through JSON serialization**
   * **Validates: Requirements 6.1, 6.3**
   */
  it('Property 9: Example spells round-trip through JSON serialization', () => {
    for (const spell of exampleSpells) {
      // Serialize to JSON
      const json = JSON.stringify(spell);
      // Parse back
      const parsed = JSON.parse(json);
      // Validate against schema
      const result = SpellSchema.safeParse(parsed);
      
      expect(result.success).toBe(true);
    }
  });
});


// ============================================================================
// Individual Example Tests
// ============================================================================

describe('GitHub Fetcher Example', () => {
  const spell = loadExample('github-fetcher.json');
  
  it('generates valid MCP server files', () => {
    const files = generateMCPServer(spell);
    
    expect(Object.keys(files)).toHaveLength(4);
    expect(files['Dockerfile']).toBeDefined();
    expect(files['package.json']).toBeDefined();
    expect(files['index.js']).toBeDefined();
    expect(files['README.md']).toBeDefined();
  });
  
  it('includes URL interpolation for owner and repo', () => {
    const files = generateMCPServer(spell);
    const serverCode = files['index.js'];
    
    expect(serverCode).toContain('interpolate');
    expect(serverCode).toContain('api.github.com');
  });
  
  it('has correct name and description in README', () => {
    const files = generateMCPServer(spell);
    const readme = files['README.md'];
    
    expect(readme).toContain('# github-fetcher');
    expect(readme).toContain('GitHub issues');
  });
  
  it('validates against SpellSchema', () => {
    const result = SpellSchema.safeParse(spell);
    expect(result.success).toBe(true);
  });
});

describe('Weather API Example', () => {
  const spell = loadExample('weather-api.json');
  
  it('generates valid MCP server files', () => {
    const files = generateMCPServer(spell);
    
    expect(Object.keys(files)).toHaveLength(4);
    expect(files['Dockerfile']).toBeDefined();
    expect(files['package.json']).toBeDefined();
    expect(files['index.js']).toBeDefined();
    expect(files['README.md']).toBeDefined();
  });
  
  it('includes URL interpolation for city and apiKey', () => {
    const files = generateMCPServer(spell);
    const serverCode = files['index.js'];
    
    expect(serverCode).toContain('interpolate');
    expect(serverCode).toContain('openweathermap');
  });
  
  it('has correct name and description in README', () => {
    const files = generateMCPServer(spell);
    const readme = files['README.md'];
    
    expect(readme).toContain('# weather-api');
    expect(readme).toContain('weather data');
  });
  
  it('validates against SpellSchema', () => {
    const result = SpellSchema.safeParse(spell);
    expect(result.success).toBe(true);
  });
});

describe('Calculator Example', () => {
  const spell = loadExample('calculator.json');
  
  it('generates valid MCP server files', () => {
    const files = generateMCPServer(spell);
    
    expect(Object.keys(files)).toHaveLength(4);
    expect(files['Dockerfile']).toBeDefined();
    expect(files['package.json']).toBeDefined();
    expect(files['index.js']).toBeDefined();
    expect(files['README.md']).toBeDefined();
  });
  
  it('includes Function constructor for script execution', () => {
    const files = generateMCPServer(spell);
    const serverCode = files['index.js'];
    
    expect(serverCode).toContain('new Function');
    expect(serverCode).not.toContain('fetch(');
  });
  
  it('has correct name and description in README', () => {
    const files = generateMCPServer(spell);
    const readme = files['README.md'];
    
    expect(readme).toContain('# calculator');
    expect(readme).toContain('arithmetic');
  });
  
  it('validates against SpellSchema', () => {
    const result = SpellSchema.safeParse(spell);
    expect(result.success).toBe(true);
  });
});
