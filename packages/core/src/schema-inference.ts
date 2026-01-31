/**
 * Schema Inference Module
 * 
 * Infers JSON Schema from actual API response data.
 * This is a key differentiator: AI guesses at schemas, Spellbook infers from real data.
 */

export interface JSONSchema {
    type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'integer';
    properties?: Record<string, JSONSchema>;
    items?: JSONSchema;
    required?: string[];
    description?: string;
}

/**
 * Infers a JSON Schema from a sample value.
 * 
 * @example
 * ```ts
 * inferSchema({ name: "John", age: 30, active: true })
 * // → {
 * //     type: "object",
 * //     properties: {
 * //       name: { type: "string" },
 * //       age: { type: "number" },
 * //       active: { type: "boolean" }
 * //     }
 * //   }
 * ```
 */
export function inferSchema(value: unknown): JSONSchema {
    if (value === null) {
        return { type: 'null' };
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return { type: 'array', items: { type: 'object' } };
        }
        // Infer from first element (assume homogeneous arrays)
        return {
            type: 'array',
            items: inferSchema(value[0])
        };
    }

    if (typeof value === 'object') {
        const properties: Record<string, JSONSchema> = {};
        const keys = Object.keys(value as Record<string, unknown>);

        for (const key of keys) {
            properties[key] = inferSchema((value as Record<string, unknown>)[key]);
        }

        return {
            type: 'object',
            properties,
            // Do NOT mark fields as required by default when inferring from a single sample
            // This prevents validation errors when APIs return optional fields that happened to be present in the sample
            // ...(keys.length > 0 && { required: keys })
        };
    }

    if (typeof value === 'number') {
        // Distinguish between integers and floats
        return { type: Number.isInteger(value) ? 'integer' : 'number' };
    }

    if (typeof value === 'boolean') {
        return { type: 'boolean' };
    }

    // Default to string for everything else (undefined, string, etc.)
    return { type: 'string' };
}

/**
 * Creates a simplified schema suitable for MCP tool input/output.
 * Flattens nested structures and extracts top-level properties.
 */
export function inferSimpleSchema(value: unknown): {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
} {
    const schema = inferSchema(value);

    if (schema.type !== 'object' || !schema.properties) {
        // Wrap non-objects
        return {
            type: 'object',
            properties: {
                data: { type: schema.type }
            }
        };
    }

    // Simplify nested properties to just their types
    const simpleProps: Record<string, { type: string }> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
        simpleProps[key] = { type: prop.type };
    }

    return {
        type: 'object',
        properties: simpleProps,
        ...(schema.required && { required: schema.required })
    };
}

/**
 * Extracts parameter names from a URL template with {{placeholder}} syntax.
 * 
 * @example
 * ```ts
 * extractUrlParameters("https://api.example.com/users/{{userId}}/posts?limit={{limit}}")
 * // → ["userId", "limit"]
 * ```
 */
export function extractUrlParameters(urlTemplate: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const params: string[] = [];
    let match;

    while ((match = regex.exec(urlTemplate)) !== null) {
        if (!params.includes(match[1])) {
            params.push(match[1]);
        }
    }

    return params;
}

/**
 * Generates input schema from URL parameters.
 */
export function generateInputSchemaFromUrl(urlTemplate: string): {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
} {
    const params = extractUrlParameters(urlTemplate);

    const properties: Record<string, { type: string; description: string }> = {};
    for (const param of params) {
        properties[param] = {
            type: 'string',
            description: `Value for ${param} parameter`
        };
    }

    return {
        type: 'object',
        properties,
        required: params
    };
}
