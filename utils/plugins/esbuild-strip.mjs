import { parse } from 'acorn';
import { unpluginFactory } from 'unplugin-strip';

/**
 * Create a strip transform function for the given function names.
 * Uses unplugin-strip (AST-based) to reliably remove function calls
 * in all positions — statement-level, inline, inside template literals, etc.
 *
 * @param {string[]} functions - Function names to strip (e.g. 'Debug.assert').
 * @returns {(source: string) => string} Transform function.
 */
export function createStripTransform(functions) {
    const plugin = unpluginFactory({
        functions,
        sourceMap: false,
        debugger: false,
        include: '**/*.js'
    });

    const ctx = {
        parse(code) {
            return parse(code, {
                ecmaVersion: 'latest',
                sourceType: 'module'
            });
        }
    };

    return function applyStrip(source) {
        const result = plugin.transform.call(ctx, source, 'file.js');
        return result ? result.code : source;
    };
}
