/** @typedef {import('@rollup/plugin-babel').RollupBabelInputPluginOptions} RollupBabelInputPluginOptions */

/**
 * The ES5 options for babel(...) plugin.
 *
 * @param {string} buildType - Only 'debug' requires special handling so far.
 * @returns {RollupBabelInputPluginOptions} The babel options.
 */
const es5Options = buildType => ({
    babelHelpers: 'bundled',
    babelrc: false,
    comments: buildType === 'debug',
    compact: false,
    minified: false,
    presets: [
        [
            '@babel/preset-env', {
                loose: true,
                modules: false,
                targets: {
                    browsers: [
                        'fully supports webgl',
                        '> 0.1%',
                        'not dead'
                    ]
                }
            }
        ]
    ]
});

export { es5Options };
