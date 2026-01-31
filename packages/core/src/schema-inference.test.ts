/**
 * Schema Inference Tests
 */

import { describe, it, expect } from 'vitest';
import {
    inferSchema,
    inferSimpleSchema,
    extractUrlParameters,
    generateInputSchemaFromUrl
} from './schema-inference.js';

describe('inferSchema', () => {
    describe('primitive types', () => {
        it('infers null type', () => {
            expect(inferSchema(null)).toEqual({ type: 'null' });
        });

        it('infers string type', () => {
            expect(inferSchema('hello')).toEqual({ type: 'string' });
        });

        it('infers integer type for whole numbers', () => {
            expect(inferSchema(42)).toEqual({ type: 'integer' });
        });

        it('infers number type for floats', () => {
            expect(inferSchema(3.14)).toEqual({ type: 'number' });
        });

        it('infers boolean type', () => {
            expect(inferSchema(true)).toEqual({ type: 'boolean' });
            expect(inferSchema(false)).toEqual({ type: 'boolean' });
        });
    });

    describe('arrays', () => {
        it('infers empty array with object items', () => {
            expect(inferSchema([])).toEqual({
                type: 'array',
                items: { type: 'object' }
            });
        });

        it('infers array of strings', () => {
            expect(inferSchema(['a', 'b', 'c'])).toEqual({
                type: 'array',
                items: { type: 'string' }
            });
        });

        it('infers array of objects', () => {
            const result = inferSchema([{ id: 1, name: 'test' }]);
            expect(result.type).toBe('array');
            expect(result.items?.type).toBe('object');
            expect(result.items?.properties?.id.type).toBe('integer');
            expect(result.items?.properties?.name.type).toBe('string');
        });
    });

    describe('objects', () => {
        it('infers simple object', () => {
            const result = inferSchema({ name: 'John', age: 30 });
            expect(result).toEqual({
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer' }
                }
            });
        });

        it('infers nested object', () => {
            const result = inferSchema({
                user: {
                    name: 'John',
                    profile: {
                        bio: 'Developer'
                    }
                }
            });

            expect(result.type).toBe('object');
            expect(result.properties?.user.type).toBe('object');
            expect(result.properties?.user.properties?.profile.type).toBe('object');
        });

        it('infers empty object', () => {
            expect(inferSchema({})).toEqual({
                type: 'object',
                properties: {}
            });
        });
    });

    describe('real API response examples', () => {
        it('handles GitHub API response structure', () => {
            const githubResponse = {
                id: 1234567,
                name: 'my-repo',
                full_name: 'user/my-repo',
                private: false,
                owner: {
                    login: 'user',
                    id: 123
                },
                stargazers_count: 42
            };

            const result = inferSchema(githubResponse);
            expect(result.type).toBe('object');
            expect(result.properties?.id.type).toBe('integer');
            expect(result.properties?.private.type).toBe('boolean');
            expect(result.properties?.owner.type).toBe('object');
        });

        it('handles JSONPlaceholder post response', () => {
            const postResponse = {
                userId: 1,
                id: 1,
                title: 'sunt aut facere',
                body: 'quia et suscipit'
            };

            const result = inferSchema(postResponse);
            expect(result.properties?.userId.type).toBe('integer');
            expect(result.properties?.title.type).toBe('string');
        });
    });
});

describe('inferSimpleSchema', () => {
    it('simplifies nested object to flat properties', () => {
        const result = inferSimpleSchema({
            name: 'test',
            count: 5,
            active: true
        });

        expect(result.type).toBe('object');
        expect(result.properties.name.type).toBe('string');
        expect(result.properties.count.type).toBe('integer');
        expect(result.properties.active.type).toBe('boolean');
    });

    it('wraps non-objects in data property', () => {
        const result = inferSimpleSchema(['a', 'b', 'c']);
        expect(result.properties.data.type).toBe('array');
    });
});

describe('extractUrlParameters', () => {
    it('extracts single parameter', () => {
        expect(extractUrlParameters('https://api.example.com/users/{{userId}}'))
            .toEqual(['userId']);
    });

    it('extracts multiple parameters', () => {
        expect(extractUrlParameters('https://api.example.com/repos/{{owner}}/{{repo}}/issues'))
            .toEqual(['owner', 'repo']);
    });

    it('extracts query parameters', () => {
        expect(extractUrlParameters('https://api.example.com/search?q={{query}}&limit={{limit}}'))
            .toEqual(['query', 'limit']);
    });

    it('deduplicates repeated parameters', () => {
        expect(extractUrlParameters('https://api.example.com/{{id}}/related/{{id}}'))
            .toEqual(['id']);
    });

    it('returns empty array for no parameters', () => {
        expect(extractUrlParameters('https://api.example.com/users'))
            .toEqual([]);
    });
});

describe('generateInputSchemaFromUrl', () => {
    it('generates schema from URL parameters', () => {
        const result = generateInputSchemaFromUrl(
            'https://api.github.com/repos/{{owner}}/{{repo}}'
        );

        expect(result).toEqual({
            type: 'object',
            properties: {
                owner: { type: 'string', description: 'Value for owner parameter' },
                repo: { type: 'string', description: 'Value for repo parameter' }
            },
            required: ['owner', 'repo']
        });
    });
});
