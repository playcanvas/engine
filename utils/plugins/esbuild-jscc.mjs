import jscc from 'jscc';

/**
 * @param {string} source - The source code.
 * @param {Record<string, string|number>} values - The JSCC values.
 * @param {boolean} keepLines - Whether to preserve line count.
 * @returns {string} The processed source code.
 */
const processJSCC = (source, values, keepLines) => {
    const result = jscc(source, null, {
        values,
        keepLines,
        sourceMap: false,
        prefixes: ['// ']
    });

    return result.code;
};

export { processJSCC };
