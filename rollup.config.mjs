import * as fs from 'node:fs';
import { version, revision } from './utils/rollup-version-revision.mjs';
import { buildTarget } from './utils/rollup-build-target.mjs';
import { scriptTarget } from './utils/rollup-script-target.mjs';

// unofficial package plugins
import dts from 'rollup-plugin-dts';

// custom plugins
import { runTsc } from './utils/plugins/rollup-run-tsc.mjs';
import { typesFixup } from './utils/plugins/rollup-types-fixup.mjs';

/** @typedef {import('rollup').RollupOptions} RollupOptions */

console.log(`Building PlayCanvas Engine v${version} revision ${revision}`);

/**
 * @type {['release', 'debug', 'profiler', 'min']}
 */
const BUILD_TYPES = ['release', 'debug', 'profiler', 'min'];

/**
 * @type {['umd', 'esm']}
 */
const MODULE_FORMAT = ['umd', 'esm'];

/**
 * @type {RollupOptions[]}
 */
const EXTRAS_TARGETS = [
    ...scriptTarget({
        name: 'pcx',
        moduleFormat: 'umd',
        input: 'extras/index.js',
        output: 'build/playcanvas-extras.js'
    }),
    ...scriptTarget({
        name: 'pcx',
        moduleFormat: 'esm',
        input: 'extras/index.js',
        output: 'build/playcanvas-extras'
    })
];

/**
 * @type {RollupOptions[]}
 */
const TYPES_TARGET = [{
    input: 'build/playcanvas/index.d.ts',
    output: [{
        file: 'build/playcanvas.d.ts',
        footer: 'export as namespace pc;',
        format: 'es'
    }],
    plugins: [
        runTsc('tsconfig.engine.json'),
        typesFixup(),
        dts()
    ]
}, {
    input: 'build/playcanvas-extras/index.d.ts',
    output: [{
        file: 'build/playcanvas-extras.d.ts',
        format: 'es'
    }],
    plugins: [
        runTsc('tsconfig.extras.json'),
        dts()
    ],
    external: ['playcanvas']
}];

/**
 * @type {RollupOptions[]}
 */
const targets = [];

const envTarget = process.env.target ? process.env.target.toLowerCase() : null;

if (envTarget === null && fs.existsSync('build')) {
    // no targets specified, clean build directory
    fs.rmSync('build', { recursive: true });
}

BUILD_TYPES.forEach((buildType) => {
    MODULE_FORMAT.forEach((moduleFormat) => {
        if (envTarget === null || envTarget === buildType || envTarget === moduleFormat || envTarget === `${moduleFormat}:${buildType}`) {
            targets.push(...buildTarget({
                moduleFormat,
                buildType
            }));
        }
    });
});

if (envTarget === null || envTarget === 'extras') {
    targets.push(...EXTRAS_TARGETS);
}

if (envTarget === null || envTarget === 'types') {
    targets.push(...TYPES_TARGET);
}

export default targets;
