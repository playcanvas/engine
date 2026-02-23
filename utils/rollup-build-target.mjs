import dts from 'rollup-plugin-dts';

import { runTsc } from './plugins/rollup-run-tsc.mjs';
import { typesFixup } from './plugins/rollup-types-fixup.mjs';

/**
 * Build rollup options for TypeScript definitions.
 *
 * @param {object} options - The build target options.
 * @param {string} [options.root] - The root directory for finding the TypeScript definitions.
 * @param {string} [options.dir] - The output directory for the TypeScript definitions.
 * @returns {import('rollup').RollupOptions} Rollup targets.
 */
function buildTypesOption({
    root = '.',
    dir = 'build'
} = {}) {
    return {
        input: `${root}/build/playcanvas/src/index.d.ts`,
        output: [{
            file: `${dir}/playcanvas.d.ts`,
            footer: 'export as namespace pc;\nexport as namespace pcx;',
            format: 'es'
        }],
        watch: {
            include: `${root}/src/**`
        },
        plugins: [
            runTsc(`${root}/tsconfig.build.json`),
            typesFixup(root),
            dts()
        ]
    };
}

export { buildTypesOption };
