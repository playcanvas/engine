/** @typedef {import('@rollup/plugin-babel').RollupBabelInputPluginOptions} RollupBabelInputPluginOptions */

/**
 * The ES6 options for babel(...) plugin.
 *
 * @param {boolean} isDebug - Whether the build is for debug.
 * @param {boolean} isES5 - Whether the build is for ES5.
 * @returns {RollupBabelInputPluginOptions} The babel options.
 */
function babelOptions(isDebug, isES5) {
    return {
        babelHelpers: 'bundled',
        babelrc: false,
        comments: isDebug,
        compact: false,
        minified: false,
        presets: [
            [
                '@babel/preset-env', {
                    bugfixes: !isES5,
                    loose: true,
                    modules: false,
                    targets: {
                        esmodules: !isES5,
                        browsers: isES5 ? [
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
