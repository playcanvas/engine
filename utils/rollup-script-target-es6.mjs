// 1st party Rollup plugins
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';

import { getBanner } from './rollup-get-banner.mjs';
import { moduleOptions } from './rollup-module-options.mjs';
import { spacesToTabs } from './rollup-spaces-to-tabs.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */
/** @typedef {import('rollup').OutputOptions} OutputOptions */

/**
 * Build an ES6 target that rollup is supposed to build.
 *
 * @param {string} name - The name, like `pcx` or `VoxParser`.
 * @param {string} input - The input file, like `extras/index.js`.
 * @param {string} output - The output file, like `build/playcanvas-extras.mjs`.
 * @param {Boolean} [shouldBundle] - Whether the target should be bundled.
 * @returns {RollupOptions} One rollup target.
 */
function scriptTargetEs6(name, input, output, shouldBundle = false) {
    /** @type {OutputOptions} */
    const outputOptions = {
        name: name,
        banner: getBanner(''),
        format: 'es',
        indent: '\t',
        preserveModules: !shouldBundle
    };
    outputOptions[shouldBundle ? 'file' : 'dir'] = output;

    return {
        input: input,
        output: outputOptions,
        plugins: [
            resolve(),
            babel(moduleOptions('release')),
            spacesToTabs(true)
        ],
        external: ['playcanvas', 'fflate']
    };
}

export { scriptTargetEs6 };
