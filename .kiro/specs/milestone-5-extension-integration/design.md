# Design Document - Milestone 5: Extension Integration & Polish

## Overview

This milestone enhances the VS Code extension with professional polish, including interactive schema building, progress indicators, better validation, optional HTTP configuration, and example spells.

## Architecture

### Component Structure

```
extensions/vscode/src/
├── commands/
│   └── create-spell.ts (enhanced)
├── utils/
│   ├── schema-builder.ts (new)
│   ├── examples.ts (new)
│   └── validation.ts (new)
└── extension.ts
```

## Components and Interfaces

### utils/schema-builder.ts

**Responsibilities:**
- Interactive JSON schema building
- Property collection
- Type selection

**Interface:**
```typescript
export async function buildSchema(schemaType: 'input' | 'output'): Promise<object>;
```

### utils/examples.ts

**Responsibilities:**
- Provide example spell definitions
- Pre-fill form with example data

**Interface:**
```typescript
export interface ExampleSpell {
  name: string;
  description: string;
  action: Action;
  inputSchema: object;
  outputSchema: object;
}

export const examples: Record<string, ExampleSpell>;
export async function selectExample(): Promise<ExampleSpell | undefined>;
```

### utils/validation.ts

**Responsibilities:**
- Enhanced validation messages
- Input format examples

**Interface:**
```typescript
export function validateSpellName(value: string): string | null;
export function validateDescription(value: string): string | null;
export function validateUrl(value: string): string | null;
```

## Data Models

### Schema Building Flow

1. Ask: "Add properties to schema?"
2. If yes:
   - Prompt for property name
   - Prompt for property type (string, number, boolean, object, array)
   - Add to schema
   - Repeat
3. If no: Return schema

### Example Spells

```typescript
const examples = {
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
      }
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
      }
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
        code: `
const { a, b, operation } = input;
switch (operation) {
  case 'add': return { result: a + b };
  case 'subtract': return { result: a - b };
  case 'multiply': return { result: a * b };
  case 'divide': return { result: b !== 0 ? a / b : 'Error: Division by zero' };
  default: return { error: 'Invalid operation' };
}
        `.trim()
      }
    },
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
        operation: { type: 'string' }
      }
    },
    outputSchema: { type: 'object' }
  }
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Schema validity

*For any* schema built through the interactive builder, the result should be valid JSON Schema

**Validates: Requirements 1.6**

### Property 2: Example completeness

*For any* example spell, all required fields should be pre-filled with valid values

**Validates: Requirements 5.3, 5.4**

### Property 3: Progress indication

*For any* generation operation, a progress indicator should be shown and then hidden upon completion

**Validates: Requirements 2.1, 2.2, 2.3**

## Error Handling

### Enhanced Validation Messages

```typescript
// Before
"Name must be 3-50 characters (letters, numbers, hyphens only)"

// After
"Name must be 3-50 characters (letters, numbers, hyphens only). Example: github-fetcher"
```

### Progress Indication

```typescript
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: "Creating MCP Server",
  cancellable: false
}, async (progress) => {
  progress.report({ message: "Generating files..." });
  const files = generateMCPServer(spell);
  
  progress.report({ message: "Writing to workspace..." });
  // Write files
  
  progress.report({ message: "Done!" });
});
```

## Testing Strategy

### Manual Testing

1. **Schema builder**: Test adding multiple properties, different types
2. **Examples**: Test each example spell, verify pre-filled values
3. **Progress**: Verify progress shows and hides correctly
4. **Validation**: Test enhanced error messages
5. **HTTP options**: Test headers and body collection

## Implementation Details

### Schema Builder Implementation

```typescript
export async function buildSchema(schemaType: 'input' | 'output'): Promise<object> {
  const properties: Record<string, any> = {};
  
  while (true) {
    const addProperty = await vscode.window.showQuickPick(['Yes', 'No'], {
      placeHolder: `Add property to ${schemaType} schema?`
    });
    
    if (addProperty !== 'Yes') break;
    
    const propName = await vscode.window.showInputBox({
      prompt: 'Property name',
      placeHolder: 'userId'
    });
    if (!propName) continue;
    
    const propType = await vscode.window.showQuickPick(
      ['string', 'number', 'boolean', 'object', 'array'],
      { placeHolder: 'Property type' }
    );
    if (!propType) continue;
    
    properties[propName] = { type: propType };
  }
  
  return {
    type: 'object',
    properties
  };
}
```

### Enhanced Command Flow

1. Ask: "Start from example or create new?"
2. If example: Show examples, pre-fill
3. If new: Collect inputs as before
4. Use schema builder for input/output schemas
5. Show progress during generation
6. Open README on success

## Security Considerations

- Examples use safe, public APIs
- No API keys hardcoded
- User-provided code still not executed by extension

## Performance Considerations

- Schema builder is interactive but fast
- Progress indicator doesn't block UI
- Examples are pre-defined (no network calls)
