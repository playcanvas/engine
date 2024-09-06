/** @typedef {import('@swc/core').Options} SWCOptions */

/**
 * The options for swc(...) plugin.
 *
 * @param {boolean} isUMD - Whether the build is for UMD.
 * @returns {SWCOptions} The swc options.
 */
function swcOptions(isUMD, minify) {
    return {
        minify,
        jsc: {
            minify: minify ? { mangle: true } : undefined,
            externalHelpers: false
        },
        env: {
            loose: true,
            targets: isUMD ? 'fully supports webgl, > 0.1%, not dead' : undefined
        }
    };

}

export { swcOptions };
