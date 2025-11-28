// kiro-generated
/**
 * Example Spells
 * 
 * Pre-defined example spells for quick start.
 */

import * as vscode from 'vscode';
import type { Spell } from '@spellbook/core';

export type ExampleSpell = Omit<Spell, 'id'>;

export const examples: Record<string, ExampleSpell> = {
  'github-fetcher': {
    name: 'github-fetcher',
    description: 'Fetches GitHub issues by repository and label. Useful for tracking bugs, features, and pull requests across multiple repositories.',
    action: {
      type: 'http',
      config: {
        url: 'https://api.github.com/repos/{{owner}}/{{repo}}/issues',
        method: 'GET'
      }
    },
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' }
      },
      required: ['owner', 'repo']
    },
    outputSchema: { type: 'array' }
  },
  
  'weather-api': {
    name: 'weather-api',
    description: 'Fetches current weather data for a given city. Returns temperature, conditions, humidity, and wind speed from OpenWeatherMap API.',
    action: {
      type: 'http',
      config: {
        url: 'https://api.openweathermap.org/data/2.5/weather?q={{city}}&appid={{apiKey}}',
        method: 'GET'
      }
    },
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        apiKey: { type: 'string' }
      },
      required: ['city', 'apiKey']
    },
    outputSchema: { type: 'object' }
  },
  
  'calculator': {
    name: 'calculator',
    description: 'Performs basic arithmetic operations on two numbers. Supports addition, subtraction, multiplication, and division with proper error handling for division by zero.',
    action: {
      type: 'script',
      config: {
        runtime: 'node',
        code: `const { a, b, operation } = input;
switch (operation) {
  case 'add': return { result: a + b };
  case 'subtract': return { result: a - b };
  case 'multiply': return { result: a * b };
  case 'divide': return { result: b !== 0 ? a / b : 'Error: Division by zero' };
  default: return { error: 'Invalid operation' };
}`
      }
    },
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
        operation: { type: 'string' }
      },
      required: ['a', 'b', 'operation']
    },
    outputSchema: { type: 'object' }
  }
};

/**
 * Shows a quick pick to select an example spell.
 * 
 * @returns Selected example spell or undefined if cancelled
 */
export async function selectExample(): Promise<ExampleSpell | undefined> {
  const exampleNames = Object.keys(examples);
  const selected = await vscode.window.showQuickPick(exampleNames, {
    placeHolder: 'Select an example spell',
    title: 'Example Spells'
  });
  
  if (!selected) return undefined;
  
  return examples[selected];
}
