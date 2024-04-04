// 1st party Rollup plugins
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';

import { getBanner } from './rollup-get-banner.mjs';
import { babelOptions } from './rollup-babel-options.mjs';
import { spacesToTabs } from './plugins/rollup-spaces-to-tabs.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */

/**
 * Build an ES6 target that rollup is supposed to build (bundled and unbundled).
 *
 * @param {object} options - The script target options.
 * @param {string} options.name - The name, like `pcx`.
 * @param {'es5'|'es6'} options.moduleFormat - The module format.
 * @param {string} options.input - The input file, like `extras/index.js`.
 * @param {string} options.output - The output file, like `build/playcanvas-extras.mjs`.
 * @param {boolean} [options.skipBundled] - Whether to skip the bundled target (ES6 only).
 * @returns {RollupOptions[]} Rollup targets.
 */
function scriptTarget({ name, moduleFormat, input, output, skipBundled = false }) {
    const isES5 = moduleFormat === 'es5';

    const targets = [];

    /**
     * @type {RollupOptions}
     */
    const target = {
        input,
        output: {
            banner: getBanner(''),
            format: isES5 ? 'umd' : 'es',
            indent: '\t',
            name: name,
            preserveModules: !isES5,
            globals: isES5 ? { playcanvas: 'pc' } : undefined,
            file: isES5 ? output : undefined,
            dir: !isES5 ? output : undefined
        },
        plugins: [
            resolve(),
            babel(babelOptions(false, isES5)),
            spacesToTabs()
        ],
        external: isES5 ? ['playcanvas'] : ['playcanvas', 'fflate']
    };
    targets.push(target);

    if (!skipBundled && !isES5) {
        /**
         * @type {RollupOptions}
         */
        const target = {
            input: `${output}/index.js`,
            output: {
                banner: getBanner(''),
                format: 'es',
                indent: '\t',
                name: name,
                preserveModules: false,
                file: `${output}.mjs`
            },
            external: ['playcanvas', 'fflate']
        };
        targets.push(target);
    }

    return targets;
}

export { scriptTarget };
