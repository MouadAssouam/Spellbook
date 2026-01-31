
import { spawn } from 'child_process';
import { readFileSync, unlinkSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_SPELL_NAME = 'test-auto-register';
const TARGET_DIR = join(process.cwd(), 'temp-test-output');

// Clean up previous run
if (existsSync(TARGET_DIR)) {
    rmSync(TARGET_DIR, { recursive: true, force: true });
}

// Prepare JSON-RPC request
const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
        name: 'create_spell',
        arguments: {
            name: TEST_SPELL_NAME,
            description: 'A test spell to verify auto-registration',
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' },
            action: {
                type: 'script',
                config: {
                    runtime: 'node',
                    code: 'return { success: true };'
                }
            },
            outputDir: TARGET_DIR
        }
    }
};

// Spawn the server
console.log('Starting server...');
const server = spawn('node', ['dist/spellbook-mcp.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PATH: process.env.PATH }
});

let output = '';

server.stdout.on('data', (data) => {
    output += data.toString();
    console.log('Received data:', data.toString());

    // Check for success message or error
    if (output.includes('Spell "test-auto-register" created successfully')) {
        console.log(' Success message received');
        server.kill();
    }
});

server.stderr.on('data', (data) => {
    console.error('Stderr:', data.toString());
});

// Send request
console.log('Sending request...');
server.stdin.write(JSON.stringify(request) + '\n');

server.on('close', (code) => {
    console.log(`Server exited with code ${code}`);

    // Verification Checks
    console.log('\n--- Verification ---');

    // 1. Check if files exist
    const hasFiles = existsSync(join(TARGET_DIR, TEST_SPELL_NAME, 'package.json'));
    console.log(`1. Files Generated: ${hasFiles ? '' : ''}`);

    // 2. Check if node_modules exist (npm install ran)
    const hasNodeModules = existsSync(join(TARGET_DIR, TEST_SPELL_NAME, 'node_modules'));
    console.log(`2. Dependencies Installed: ${hasNodeModules ? '' : ''}`);

    // 3. Check mcp.json
    try {
        const mcpPath = join(process.cwd(), '../../.kiro/settings/mcp.json');
        const mcpContent = readFileSync(mcpPath, 'utf-8');
        const mcpJson = JSON.parse(mcpContent);
        const isRegistered = !!mcpJson.mcpServers[TEST_SPELL_NAME];
        console.log(`3. Auto-registered in mcp.json: ${isRegistered ? '' : ''}`);

        // Cleanup mcp.json
        if (isRegistered) {
            delete mcpJson.mcpServers[TEST_SPELL_NAME];
            //   import('fs').then(fs => fs.writeFileSync(mcpPath, JSON.stringify(mcpJson, null, 2)));
            console.log('   (Note: Remember to manually cleanup mcp.json or reverted by test if implemented)');
        }
    } catch (e) {
        console.log(`3. Auto-register check failed: ${e.message}`);
    }
});
