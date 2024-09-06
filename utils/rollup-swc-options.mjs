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
        minify: minify,
        jsc: {
            minify: {
                format: {
                    comments: isDebug ? 'all' : false
                },
                compress: minify && isDebug ? {
                    drop_console: false
                } : undefined
            },
            externalHelpers: false
        },
        env: isUMD ? {
            loose: true,
            targets: isUMD ? 'fully supports webgl, > 0.1%, not dead' : undefined
        } : undefined
    };

}

export { swcOptions };
