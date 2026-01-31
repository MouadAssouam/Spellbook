
import { generateMCPServer } from './dist/generator.js';
import { parseOpenAPI } from './dist/openapi.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Sample Petstore OpenAPI JSON (simplified)
const petstoreSpec = {
    "openapi": "3.0.0",
    "info": {
        "version": "1.0.0",
        "title": "Swagger Petstore",
        "description": "A sample API that uses a petstore as an example to demonstrate features in the OpenAPI 3.0 specification"
    },
    "servers": [
        {
            "url": "http://petstore.swagger.io/api"
        }
    ],
    "paths": {
        "/pets": {
            "get": {
                "summary": "List all pets",
                "operationId": "listPets",
                "tags": ["pets"],
                "parameters": [
                    {
                        "name": "limit",
                        "in": "query",
                        "description": "How many items to return at one time (max 100)",
                        "required": false,
                        "schema": {
                            "type": "integer",
                            "format": "int32"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "A paged array of pets",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/Pets"
                                }
                            }
                        }
                    }
                }
            },
            "post": {
                "summary": "Create a pet",
                "operationId": "createPet",
                "tags": ["pets"],
                "responses": {
                    "201": {
                        "description": "Null response"
                    }
                }
            }
        },
        "/pets/{petId}": {
            "get": {
                "summary": "Info for a specific pet",
                "operationId": "showPetById",
                "tags": ["pets"],
                "parameters": [
                    {
                        "name": "petId",
                        "in": "path",
                        "required": true,
                        "description": "The id of the pet to retrieve",
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Expected response to a valid request",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/Pet"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

console.log('Testing parseOpenAPI...');

try {
    const spell = parseOpenAPI(petstoreSpec);

    // Basic checks
    if (spell.name !== 'swagger-petstore') throw new Error(`Unexpected name: ${spell.name}`);
    if (spell.tools.length !== 3) throw new Error(`Unexpected tool count: ${spell.tools.length}, expected 3`);

    // Check list-pets
    const listPets = spell.tools.find(t => t.name === 'list-pets');
    if (!listPets) throw new Error('Missing list-pets tool');
    if (listPets.action.type !== 'http') throw new Error('list-pets action not http');
    if (listPets.action.config.method !== 'GET') throw new Error('list-pets method not GET');
    if (listPets.action.config.url !== 'http://petstore.swagger.io/api/pets') throw new Error(`Unexpected URL: ${listPets.action.config.url}`);

    // Check show-pet-by-id (path param)
    const showPet = spell.tools.find(t => t.name === 'show-pet-by-id');
    if (!showPet) throw new Error('Missing show-pet-by-id tool');
    if (showPet.action.config.url !== 'http://petstore.swagger.io/api/pets/{{petId}}') throw new Error(`Unexpected interpolated URL: ${showPet.action.config.url}`);
    if (!showPet.inputSchema.required.includes('petId')) throw new Error('petId should be required');


    console.log('Parsing successful! Generating server...');

    const files = generateMCPServer(spell);
    const outputDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'temp-openapi-test');

    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir);

    for (const [filename, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(outputDir, filename), content);
    }

    // Verify index.js contains handlers
    const indexJs = files['index.js'];
    if (!indexJs.includes("'list-pets': {")) throw new Error('index.js missing list-pets definition');
    if (!indexJs.includes("'show-pet-by-id': {")) throw new Error('index.js missing show-pet-by-id definition');

    console.log('Verification PASSED!');

} catch (e) {
    if (e instanceof Error && 'errors' in e) {
        fs.writeFileSync('verification-error.json', JSON.stringify(e.errors, null, 2));
    } else {
        fs.writeFileSync('verification-error.json', String(e));
    }
    console.error('Verification FAILED');
    process.exit(1);
}
