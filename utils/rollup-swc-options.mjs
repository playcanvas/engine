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
                // format: {
                //     comments: !isDebug || minify ? false : 'some'
                // },
                mangle: minify,
                compress: (!isDebug && minify) ? {
                    reduce_funcs: true,
                    drop_console: true,
                    pure_funcs: [],
                    inline: 3
                } : undefined
            },
            externalHelpers: false,
            loose: true
        },
        env: {
            targets: isUMD ? 'fully supports webgl and > 0.1% and not dead' : 'supports es6-module'
        }
    };

}

export { swcOptions };
