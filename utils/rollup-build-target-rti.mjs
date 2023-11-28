import resolve from '@rollup/plugin-node-resolve';
import { shaderChunks } from './rollup-shader-chunks.mjs';
import { engineLayerImportValidation } from './rollup-import-validation.mjs';
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
 * @returns {RollupOptions} Configuration for Runtime Type Inspector rollup target.
 */
function buildTargetRTI(moduleFormat) {
    // const banner = ' (RUNTIME-TYPE-INSPECTOR)';

    const outputExtension = {
        es5: '.js',
        es6: '.mjs'
    };

    const file = `dist/iframe/ENGINE_PATH/playcanvas.rti${outputExtension[moduleFormat]}`;

    /** @type {Record<string, ModuleFormat>} */
    const outputFormat = {
        es5: 'umd',
        es6: 'es'
    };

    /** @type {OutputOptions} */
    const outputOptions = {
        // getBanner(banner[buildType]),
        // banner: moduleFormat === 'es5' && banner[buildType]),
        format: outputFormat[moduleFormat],
        indent: '\t',
        name: 'pc',
        file
    };
    const rootFile = '../src/index.rti.js';
    return {
        input: rootFile,
        output: outputOptions,
        plugins: [
            engineLayerImportValidation(rootFile, true),
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
