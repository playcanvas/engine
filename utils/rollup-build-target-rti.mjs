import resolve from '@rollup/plugin-node-resolve';
import { engineLayerImportValidation } from './rollup-import-validation.mjs';
import { getBanner } from './rollup-get-banner.mjs';
import { runtimeTypeInspector } from '@runtime-type-inspector/plugin-rollup';

/** @typedef {import('rollup').RollupOptions} RollupOptions */
/** @typedef {import('rollup').OutputOptions} OutputOptions */
/** @typedef {import('rollup').ModuleFormat} ModuleFormat */
/** @typedef {import('@rollup/plugin-babel').RollupBabelInputPluginOptions} RollupBabelInputPluginOptions */
/** @typedef {import('@rollup/plugin-strip').RollupStripOptions} RollupStripOptions */

/**
 * Configure a Runtime Type Inspector target that rollup is supposed to build.
 *
 * @param {'es5'|'es6'} moduleFormat - The module format.
 * @param {string} input - The input file.
 * @param {string} buildDir - The build dir.
 * @returns {RollupOptions} Configuration for Runtime Type Inspector rollup target.
 */
function buildTargetRTI(moduleFormat, input = 'src/index.rti.js', buildDir = 'build') {
    const banner = getBanner(' (RUNTIME-TYPE-INSPECTOR)');

    const outputExtension = {
        es5: '.js',
        es6: '.mjs'
    };

    const file = `${buildDir}/playcanvas.rti${outputExtension[moduleFormat]}`;

    /** @type {Record<string, ModuleFormat>} */
    const outputFormat = {
        es5: 'umd',
        es6: 'es'
    };

    /** @type {OutputOptions} */
    const outputOptions = {
        banner,
        format: outputFormat[moduleFormat],
        indent: '\t',
        name: 'pc',
        file
    };

    return {
        input,
        output: outputOptions,
        plugins: [
            engineLayerImportValidation(input, true),
            resolve(),
            runtimeTypeInspector({
                ignoredFiles: [
                    'framework/parsers/draco-worker.js' // runs in Worker context without RTI
                ]
            })
        ]
    };
}
export { buildTargetRTI };
