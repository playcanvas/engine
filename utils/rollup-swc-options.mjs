/** @typedef {import('@swc/core').Config} SWCOptions */

/**
 * The options for swc(...) plugin.
 *
 * @param {boolean} isDebug - Whether the build is for debug.
 * @param {boolean} minify - Whether to minify.
 * @returns {SWCOptions} The swc options.
 */
function swcOptions(isDebug, minify) {

    return {
        minify,
        jsc: {
            target: 'es2020',
            minify: {
                format: {
                    comments: !isDebug || minify ? 'some' : 'all'
                },
                mangle: minify,
                compress: (!isDebug && minify) ? {
                    drop_console: true,
                    pure_funcs: []
                } : undefined
            },
            externalHelpers: false,
            loose: true
        }
    };

}

export { swcOptions };
