import { parse } from 'acorn';
import strip from '@rollup/plugin-strip';

/**
 * @param {string[]} functions - Function names to strip.
 * @returns {(source: string, file?: string) => string} The strip transform.
 */
const createStripTransform = (functions) => {
    const plugin = strip({
        functions,
        debugger: false,
        sourceMap: false
    });

    const context = {
        parse(code) {
            return parse(code, {
                ecmaVersion: 'latest',
                sourceType: 'module'
            });
        }
    };

    return (source, file = 'source.js') => {
        const result = plugin.transform.call(context, source, file);
        return result ? result.code : source;
    };
};

export { createStripTransform };
