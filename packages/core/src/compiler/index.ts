/**
 * Spellbook AST Compiler
 * 
 * Exports the compiler, AST types, passes, and code generator.
 */

// AST
export { parseSpell } from './ast.js';
export type {
    SpellAST,
    ToolNode,
    ActionNode,
    HTTPActionNode,
    ScriptActionNode,
    ImportNode,
    MiddlewareNode,
    ASTNode,
    ASTNodeType,
} from './ast.js';

// Passes
export {
    ImportCollectionPass,
    TelemetryInjectionPass,
    ResilienceInjectionPass,
    ValidationPass,
    SecretInjectionPass,
} from './passes.js';
export type { CompilationPass } from './passes.js';

// Code Generator
export { generateCode } from './codegen.js';
export type { GeneratedCode } from './codegen.js';

// Compiler
export { SpellbookCompiler, compileSpell } from './compiler.js';
export type { CompilerOptions, CompilationResult, PassResult } from './compiler.js';
