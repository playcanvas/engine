// 1st party Rollup plugins
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';

import { getBanner } from './rollup-get-banner.mjs';
import { es5Options, moduleOptions } from './rollup-babel-options.mjs';
import { spacesToTabs } from './plugins/rollup-spaces-to-tabs.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */

/**
 * Build an ES6 target that rollup is supposed to build.
 *
 * @param {string} name - The name, like `pcx`.
 * @param {'es5'|'es6'} moduleFormat - The module format.
 * @param {string} input - The input file, like `extras/index.js`.
 * @param {string} output - The output file, like `build/playcanvas-extras.mjs`.
 * @param {boolean} [shouldBundle] - Whether the target should be bundled.
 * @returns {RollupOptions} One rollup target.
 */
function scriptTarget(name, moduleFormat, input, output, shouldBundle = false) {
    const isES5 = moduleFormat === 'es5';
    const bundled = isES5 || shouldBundle;

    return {
        input: input,
        output: {
            banner: getBanner(''),
            format: isES5 ? 'umd' : 'es',
            indent: '\t',
            name: name,
            preserveModules: !bundled,
            globals: isES5 ? { playcanvas: 'pc' } : undefined,
            file: bundled ? output : undefined,
            dir: !bundled ? output : undefined
        },
        plugins: [
            resolve(),
            babel(isES5 ? es5Options('release') : moduleOptions('release')),
            spacesToTabs()
        ],
        external: ['playcanvas', 'fflate']
    };
}

export { scriptTarget };
