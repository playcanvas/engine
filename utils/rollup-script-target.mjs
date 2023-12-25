// 1st party Rollup plugins
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';

import { getBanner } from './rollup-get-banner.mjs';
import { es5Options } from './rollup-es5-options.mjs';
import { spacesToTabs } from './rollup-spaces-to-tabs.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */

/**
 * Build an ES5 target that rollup is supposed to build.
 *
 * @param {string} name - The name, like `pcx` or `VoxParser`.
 * @param {string} input - The input file, like `extras/index.js`.
 * @param {string} [output] - If not given, input is used.
 * @returns {RollupOptions} One rollup target.
 */
function scriptTarget(name, input, output) {
    return {
        input: input,
        output: {
            name: name,
            banner: getBanner(''),
            file: output || input.replace('.mjs', '.js'),
            format: 'umd',
            indent: '\t',
            globals: { playcanvas: 'pc' }
        },
        plugins: [
            resolve(),
            babel(es5Options('release')),
            spacesToTabs(true)
        ],
        external: ['playcanvas'],
        cache: false
    };
}

export { scriptTarget };
