import * as fs from 'node:fs';
import { exec } from 'node:child_process';
import { version, revision } from './utils/rollup-version-revision.mjs';
import { buildTarget } from './utils/rollup-build-target.mjs';
import { scriptTarget } from './utils/rollup-script-target.mjs';
import { scriptTargetEs6 } from './utils/rollup-script-target-es6.mjs';

// 3rd party Rollup plugins
import dts from 'rollup-plugin-dts';

/** @typedef {import('rollup').RollupOptions} RollupOptions */

console.log(`Building PlayCanvas Engine v${version} revision ${revision}`);

const target_extras = [
    scriptTarget('pcx', 'extras/index.js', 'build/playcanvas-extras.js'),
    scriptTargetEs6('pcx', 'extras/index.js', 'build/playcanvas-extras.mjs'),
    scriptTarget('VoxParser', 'scripts/parsers/vox-parser.mjs')
];

/** @type {RollupOptions} */
const target_types = {
    input: 'types/index.d.ts',
    output: [{
        file: 'build/playcanvas.d.ts',
        footer: 'export as namespace pc;',
        format: 'es'
    }],
    plugins: [
        dts()
    ]
};

function buildTypes() {
    const start = Date.now();
    const child = exec('npm run build:types');
    child.on('exit', function () {
        const end = Date.now();
        const delta = (end - start) / 1000;
        console.log(`created build/playcanvas.d.ts in ${delta}s`);
    });
}

export default (args) => {
    /** @type {RollupOptions[]} */
    const targets = [];

    const envTarget = process.env.target ? process.env.target.toLowerCase() : null;

    if ((envTarget === null) && fs.existsSync('build')) {
        // no targets specified, clean build directory
        fs.rmSync('build', { recursive: true });
    }

    if (envTarget === 'types') {
        targets.push(target_types);
    } else if (envTarget === 'extras') {
        targets.push(...target_extras);
    } else {
        ['release', 'debug', 'profiler', 'min'].forEach((t) => {
            ['es5', 'es6'].forEach((m) => {
                if (envTarget === null || envTarget === t || envTarget === m || envTarget === `${t}_${m}`) {
                    targets.push(buildTarget(t, m));
                }
            });
        });

        if (envTarget === null) {
            // no targets specified, build them all
            buildTypes();
            targets.push(...target_extras);
        }
    }

    return targets;
};
