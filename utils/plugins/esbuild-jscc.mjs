import jscc from 'jscc';

/**
 * Apply JSCC processing to source text.
 *
 * Processes `// #if _VAR` / `// #else` / `// #endif` comment-based directives
 * and replaces `$_VAR` value tokens in source code.
 *
 * @param {string} source - Source code.
 * @param {Object<string, string|number>} values - Map of variable names to values.
 * @param {boolean} keepLines - Preserve line count by replacing removed lines with blanks.
 * @returns {string} Processed source.
 */
export function processJSCC(source, values, keepLines) {
    const result = jscc(source, null, { values, keepLines, sourceMap: false });
    return result.code;
}
