// kiro-generated
/**
 * Interactive JSON Schema Builder
 * 
 * Helps users build JSON schemas through interactive prompts.
 */

import * as vscode from 'vscode';

/**
 * Builds a JSON schema interactively by prompting for properties.
 * 
 * @param schemaType - Type of schema being built ('input' or 'output')
 * @returns JSON Schema object
 */
export async function buildSchema(schemaType: 'input' | 'output'): Promise<object> {
  const properties: Record<string, any> = {};
  
  while (true) {
    const addProperty = await vscode.window.showQuickPick(['Yes', 'No'], {
      placeHolder: `Add property to ${schemaType} schema?`,
      title: `${schemaType.charAt(0).toUpperCase() + schemaType.slice(1)} Schema Builder`
    });
    
    if (addProperty !== 'Yes') break;
    
    const propName = await vscode.window.showInputBox({
      prompt: 'Property name',
      placeHolder: 'userId',
      validateInput: (value: string) => {
        if (!value) return 'Property name is required';
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
          return 'Property name must be a valid identifier (letters, numbers, underscores)';
        }
        if (properties[value]) {
          return 'Property already exists';
        }
        return null;
      }
    });
    if (!propName) continue;
    
    const propType = await vscode.window.showQuickPick(
      ['string', 'number', 'boolean', 'object', 'array'],
      { 
        placeHolder: 'Property type',
        title: `Type for "${propName}"`
      }
    );
    if (!propType) continue;
    
    properties[propName] = { type: propType };
  }
  
  return {
    type: 'object',
    properties
  };
}
