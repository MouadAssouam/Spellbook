
import { generateMCPServer } from './dist/generator.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const tools = [
    {
        name: 'get-todo',
        description: 'Fetches a todo item from the JSONPlaceholder API by its unique identifier. This tool is useful for retrieving typical todo data structure for testing purposes.',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string' }
            },
            required: ['id']
        },
        outputSchema: { type: 'object' },
        action: {
            type: 'http',
            config: {
                url: 'https://jsonplaceholder.typicode.com/todos/{{id}}',
                method: 'GET'
            }
        }
    },
    {
        name: 'calc-sum',
        description: 'Calculates the sum of two numbers provided as input attributes a and b. This is a simple utility calculation tool that executes in a Node.js sandbox environment.',
        inputSchema: {
            type: 'object',
            properties: {
                a: { type: 'number' },
                b: { type: 'number' }
            },
            required: ['a', 'b']
        },
        outputSchema: { type: 'object' },
        action: {
            type: 'script',
            config: {
                runtime: 'node',
                code: 'return { sum: input.a + input.b };'
            }
        }
    }
];

const spell = {
    id: randomUUID(),
    name: 'multi-tool-test',
    description: 'A server with multiple tools designed to verify the capability of the Spellbook generator to create multi-functional MCP servers. It includes both HTTP and Script based tools.',
    tools: tools
};

console.log('Generating server for multi-tool spell...');

try {
    const files = generateMCPServer(spell);
    const outputDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'temp-multi-test');

    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir);

    for (const [filename, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(outputDir, filename), content);
    }

    console.log('Files generated in', outputDir);

    // Verification
    const indexJs = files['index.js'];
    const readmeMd = files['README.md'];

    // Check index.js
    if (!indexJs.includes('get-todo')) throw new Error('index.js missing get-todo');
    if (!indexJs.includes('calc-sum')) throw new Error('index.js missing calc-sum');
    if (!indexJs.includes('const tool = tools[toolName]')) throw new Error('index.js missing tool lookup');

    // Verify tools object structure
    if (!indexJs.includes("'get-todo': {")) throw new Error('index.js missing get-todo definition');
    if (!indexJs.includes("'calc-sum': {")) throw new Error('index.js missing calc-sum definition');

    // Check README
    if (!readmeMd.includes('### get-todo')) throw new Error('README missing get-todo section');
    if (!readmeMd.includes('### calc-sum')) throw new Error('README missing calc-sum section');

    console.log('Verification PASSED!');

} catch (e) {
    const errorLog = e instanceof Error && 'errors' in e ? JSON.stringify(e.errors, null, 2) : String(e);
    console.error('Verification FAILED');
    fs.writeFileSync('verification-error.json', errorLog);
    process.exit(1);
}

