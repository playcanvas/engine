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
        jsc: {
            minify: { 
                mangle: true,
                format: {
                    comments: isDebug ? 'all' : false,
                },
                compress: {
                    drop_console: !isDebug,
                }
            },
            externalHelpers: false
        },
        env: {
            loose: true,
            targets: isUMD ? 'fully supports webgl, > 0.1%, not dead' : undefined
        }
    };

}

export { swcOptions };
