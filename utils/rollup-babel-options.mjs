/** @typedef {import('@rollup/plugin-babel').RollupBabelInputPluginOptions} RollupBabelInputPluginOptions */

/**
 * The options for babel(...) plugin.
 *
 * @param {boolean} isDebug - Whether the build is for debug.
 * @param {boolean} isUMD - Whether the build is for UMD.
 * @returns {RollupBabelInputPluginOptions} The babel options.
 */
function babelOptions(isDebug, isUMD) {
    return {
        babelHelpers: 'bundled',
        babelrc: false,
        comments: isDebug,
        compact: false,
        minified: false,
        presets: [
            [
                '@babel/preset-env', {
                    bugfixes: !isUMD,
                    loose: true, // DECPRECATED IN BABEL 8
                    modules: false,
                    targets: {
                        esmodules: !isUMD,
                        browsers: isUMD ? [
                            'fully supports webgl',
                            '> 0.1%',
                            'not dead'
                        ] : undefined
                    }
                }
            ]
        ]
    };

}

export { babelOptions };
