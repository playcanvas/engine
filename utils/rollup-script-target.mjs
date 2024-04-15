// 1st party Rollup plugins
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';

import { getBanner } from './rollup-get-banner.mjs';
import { babelOptions } from './rollup-babel-options.mjs';
import { spacesToTabs } from './plugins/rollup-spaces-to-tabs.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */

/**
 * Build a target that Rollup is supposed to build (bundled and unbundled).
 *
 * @param {object} options - The script target options.
 * @param {string} options.name - The name.
 * @param {'umd'|'esm'} options.moduleFormat - The module format.
 * @param {string} options.input - The input file.
 * @param {string} options.output - The output file.
 * @param {boolean} [options.skipBundled] - Whether to skip the bundled target (ESM only).
 * @returns {RollupOptions[]} Rollup targets.
 */
function scriptTarget({ name, moduleFormat, input, output, skipBundled = false }) {
    const isUMD = moduleFormat === 'umd';

    const targets = [];

    /**
     * @type {RollupOptions}
     */
    const target = {
        input,
        output: {
            banner: getBanner(''),
            format: isUMD ? 'umd' : 'es',
            indent: '\t',
            name: name,
            preserveModules: !isUMD,
            globals: isUMD ? { playcanvas: 'pc' } : undefined,
            file: isUMD ? output : undefined,
            dir: !isUMD ? output : undefined
        },
        plugins: [
            resolve(),
            babel(babelOptions(false, isUMD)),
            spacesToTabs()
        ],
        external: isUMD ? ['playcanvas'] : ['playcanvas', 'fflate']
    };
    targets.push(target);

    if (!skipBundled && !isUMD) {
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
