import * as fs from 'node:fs';
import { version, revision } from './utils/rollup-version-revision.mjs';
import { buildTarget } from './utils/rollup-build-target.mjs';
import { scriptTarget } from './utils/rollup-script-target.mjs';
import { scriptTargetEs6 } from './utils/rollup-script-target-es6.mjs';
import { runTsc } from './utils/rollup-run-tsc.mjs';
import { typesFixup } from './utils/rollup-types-fixup.mjs';

// 3rd party Rollup plugins
import dts from 'rollup-plugin-dts';

/** @typedef {import('rollup').RollupOptions} RollupOptions */

console.log(`Building PlayCanvas Engine v${version} revision ${revision}`);

/**
 * @type {['release', 'debug', 'profiler', 'min']}
 */
const BUILD_TYPES = ['release', 'debug', 'profiler', 'min'];

/**
 * @type {['es6', 'es5']}
 */
const MODULE_FORMAT = ['es6', 'es5'];

/**
 * @type {RollupOptions[]}
 */
const EXTRAS_TARGETS = [
    scriptTarget('pcx', 'extras/index.js', 'build/playcanvas-extras.js'),
    scriptTargetEs6('pcx', 'extras/index.js', 'build/playcanvas-extras', false),
    scriptTargetEs6('pcx', 'extras/index.js', 'build/playcanvas-extras.mjs', true)
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

if (envTarget === null || envTarget === 'types') {
    targets.push(...TYPES_TARGET);
}

if (envTarget === null || envTarget === 'extras') {
    targets.push(...EXTRAS_TARGETS);
}

BUILD_TYPES.forEach((type) => {
    MODULE_FORMAT.forEach((format) => {
        if (envTarget === null || envTarget === type || envTarget === format || envTarget === `${type}_${format}`) {
            targets.push(...buildTarget(type, format, 'src/index.js', 'build'));
        }
    });
});

export default targets;
