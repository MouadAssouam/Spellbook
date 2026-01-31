/**
 * Spellbook AST Compiler
 * 
 * Main compiler class that orchestrates parsing, transformation, and code generation.
 */

import type { Spell } from '../types.js';
import type { SpellAST } from './ast.js';
import { parseSpell } from './ast.js';
import type { CompilationPass } from './passes.js';
import {
    ImportCollectionPass,
    TelemetryInjectionPass,
    ResilienceInjectionPass,
    ValidationPass,
    SecretInjectionPass,
} from './passes.js';
import { generateCode, type GeneratedCode } from './codegen.js';

// ============================================================================
// Compiler Options
// ============================================================================

export interface CompilerOptions {
    /** Enable telemetry injection */
    telemetry?: boolean;
    /** Enable resilience patterns (retry, timeout) */
    resilience?: boolean;
    /** Retry attempts for HTTP actions */
    retryAttempts?: number;
    /** Timeout for HTTP actions */
    timeout?: number;
    /** Transform secrets to env vars */
    secretInjection?: boolean;
    /** Generate K8s manifests */
    k8s?: boolean;
    /** Custom passes to add */
    customPasses?: CompilationPass[];
}

// ============================================================================
// Spellbook Compiler
// ============================================================================

export class SpellbookCompiler {
    private passes: CompilationPass[] = [];

    constructor(private options: CompilerOptions = {}) {
        this.initializePasses();
    }

    private initializePasses(): void {
        // Always run validation first
        this.passes.push(new ValidationPass());

        // Secret injection (before imports so we know what's needed)
        if (this.options.secretInjection !== false) {
            this.passes.push(new SecretInjectionPass());
        }

        // Import collection
        this.passes.push(new ImportCollectionPass());

        // Telemetry
        if (this.options.telemetry !== false) {
            this.passes.push(new TelemetryInjectionPass());
        }

        // Resilience
        if (this.options.resilience !== false) {
            this.passes.push(new ResilienceInjectionPass({
                retryAttempts: this.options.retryAttempts,
                timeout: this.options.timeout,
            }));
        }

        // Custom passes
        if (this.options.customPasses) {
            this.passes.push(...this.options.customPasses);
        }
    }

    /**
     * Compile a spell definition to generated code.
     */
    compile(spell: Spell): CompilationResult {
        const startTime = Date.now();

        // Parse to AST
        let ast = parseSpell(spell);

        // Run passes
        const passResults: PassResult[] = [];
        for (const pass of this.passes) {
            const passStart = Date.now();
            ast = pass.transform(ast);
            passResults.push({
                name: pass.name,
                duration: Date.now() - passStart,
            });
        }

        // Check for validation errors
        if (ast.metadata?.isValid === false) {
            return {
                success: false,
                errors: ast.metadata.validationErrors as string[],
                ast,
                passes: passResults,
                duration: Date.now() - startTime,
            };
        }

        // Generate code
        const code = generateCode(ast);

        // Remove undefined entries
        const files: Record<string, string> = {};
        for (const [key, value] of Object.entries(code)) {
            if (value !== undefined) {
                files[key] = value;
            }
        }

        return {
            success: true,
            files,
            ast,
            passes: passResults,
            duration: Date.now() - startTime,
        };
    }

    /**
     * Add a custom pass to the compiler.
     */
    addPass(pass: CompilationPass): void {
        this.passes.push(pass);
    }

    /**
     * Get the list of passes.
     */
    getPasses(): string[] {
        return this.passes.map(p => p.name);
    }
}

// ============================================================================
// Types
// ============================================================================

export interface PassResult {
    name: string;
    duration: number;
}

export interface CompilationResult {
    success: boolean;
    files?: Record<string, string>;
    errors?: string[];
    ast: SpellAST;
    passes: PassResult[];
    duration: number;
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Compile a spell with default options.
 */
export function compileSpell(spell: Spell, options?: CompilerOptions): CompilationResult {
    const compiler = new SpellbookCompiler(options);
    return compiler.compile(spell);
}
