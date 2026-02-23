import fs from 'fs';

/**
 * esbuild plugin that implements JSCC-style conditional compilation.
 *
 * Processes `// #if _VAR` / `// #else` / `// #endif` comment-based directives
 * and replaces `$_VAR` value tokens in source code.
 *
 * @param {Object} options - Plugin options.
 * @param {Object<string, string|number>} options.values - Map of variable names to values.
 * @param {boolean} [options.keepLines] - If true, replace stripped lines with blanks
 * to preserve line numbers (useful for debug sourcemaps).
 * @returns {import('esbuild').Plugin} The esbuild plugin.
 */
export function jsccPlugin({ values = {}, keepLines = false } = {}) {
    return {
        name: 'jscc',
        setup(build) {
            build.onLoad({ filter: /\.js$/ }, async (args) => {
                let source = await fs.promises.readFile(args.path, 'utf8');
                source = processJSCC(source, values, keepLines);
                return { contents: source, loader: 'js' };
            });
        }
    };
}

/**
 * Apply JSCC processing to source text — callable without esbuild for unbundled transforms.
 *
 * @param {string} source - Source code.
 * @param {Object<string, string|number>} values - Map of variable names to values.
 * @param {boolean} keepLines - Preserve line count by replacing removed lines with blanks.
 * @returns {string} Processed source.
 */
export function processJSCC(source, values, keepLines) {
    // Replace value tokens: $_VAR_NAME → value
    for (const [key, val] of Object.entries(values)) {
        const token = `$${key}`;
        if (source.includes(token)) {
            source = source.replaceAll(token, String(val));
        }
    }

    // Process conditional directives: // #if, // #else, // #endif
    const lines = source.split('\n');
    const output = [];
    const stack = []; // stack of { active, parentActive, elseSeen }

    for (const line of lines) {
        const trimmed = line.trim();

        const ifMatch = trimmed.match(/^\/\/\s*#if\s+(\w+)/);
        if (ifMatch) {
            const varName = ifMatch[1];
            const parentActive = stack.length === 0 || stack[stack.length - 1].active;
            const active = parentActive && !!values[varName];
            stack.push({ active, parentActive, elseSeen: false });
            if (keepLines) output.push('');
            else output.push('');
            continue;
        }

        if (trimmed.match(/^\/\/\s*#else\s*$/)) {
            if (stack.length > 0) {
                const top = stack[stack.length - 1];
                top.elseSeen = true;
                top.active = top.parentActive && !top.active;
            }
            if (keepLines) output.push('');
            else output.push('');
            continue;
        }

        if (trimmed.match(/^\/\/\s*#endif\s*$/)) {
            stack.pop();
            if (keepLines) output.push('');
            else output.push('');
            continue;
        }

        if (stack.length === 0 || stack[stack.length - 1].active) {
            output.push(line);
        } else if (keepLines) {
            output.push('');
        }
    }

    return output.join('\n');
}
