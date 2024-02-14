/** @typedef {import('@rollup/plugin-babel').RollupBabelInputPluginOptions} RollupBabelInputPluginOptions */

/**
 * The ES6 options for babel(...) plugin.
 *
 * @param {string} buildType - Only 'debug' requires special handling so far.
 * @returns {RollupBabelInputPluginOptions} The babel options.
 */
const moduleOptions = buildType => ({
    babelHelpers: 'bundled',
    babelrc: false,
    comments: buildType === 'debug',
    compact: false,
    minified: false,
    presets: [
        [
            '@babel/preset-env', {
                bugfixes: true,
                loose: true,
                modules: false,
                targets: {
                    esmodules: true
                }
            }
        ]
    ]
});

export { moduleOptions };
