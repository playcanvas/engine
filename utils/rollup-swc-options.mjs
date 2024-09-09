/** @typedef {import('@swc/core').Config} SWCOptions */

/**
 * The options for swc(...) plugin.
 *
 * @param {boolean} isDebug - Whether the build is for debug.
 * @param {boolean} isUMD - Whether the build is for UMD.
 * @param {boolean} minify - Whether to minify.
 * @returns {SWCOptions} The swc options.
 */
function swcOptions(isDebug, isUMD, minify) {
    return {
        minify,
        module: {
            type: 'es6' // Keep ES module syntax (equivalent to Babel's modules: false)
        },
        jsc: {
            'parser': {
                'syntax': 'ecmascript'
            },
            minify: {
                format: {
                    comments: isDebug ? 'some' : false
                },
                compress: minify && isDebug ? {
                    drop_console: false,
                    pure_funcs: []
                } : undefined
            },
            externalHelpers: false
        },
        env: {
            loose: true,
            targets: isUMD ? 'fully supports webgl, > 0.1%, not dead' : 'chrome 63'
        }
    };

}

export { swcOptions };
