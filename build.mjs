/**
 * Build helper scripts
 * Usage: node build.mjs [options] -- [rollup options]
 *
 * Options:
 * target[:<moduleFormat>][:<buildType>][:<bundleState>] - Specify the target
 *     - moduleFormat (esm, umd)
 *     - buildType (release, debug, profiler, min)
 *     - bundleState (unbundled, bundled)
 * Example: target:esm:release:bundled
 *
 * treemap - Enable treemap build visualization (release only).
 * treenet - Enable treenet build visualization (release only).
 * treesun - Enable treesun build visualization (release only).
 * treeflame - Enable treeflame build visualization (release only).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BUILD_TYPES = /** @type {const} */ (['release', 'debug', 'profiler', 'min']);
const MODULE_FORMAT = /** @type {const} */ (['umd', 'esm']);
const BUNDLE_STATES = /** @type {const} */ (['unbundled', 'bundled']);

const TREE_FLAGS = new Set(['treemap', 'treenet', 'treesun', 'treeflame']);
const TURBO_ARGS = ['--single-package', '--ui=stream', '--output-logs=full'];
const BIN_DIR = path.join('node_modules', '.bin');

const args = process.argv.slice(2).filter(arg => arg !== '--');
const rollupArgs = [];
const trees = [];
let target = null;
let watch = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-w' || arg === '--watch') {
        watch = true;
        continue;
    }

    if (arg.startsWith('target') && args[i - 1] !== '--environment') {
        target = arg.startsWith('target:') ? arg.slice('target:'.length) : '';
        continue;
    }

    if (TREE_FLAGS.has(arg) && args[i - 1] !== '--environment') {
        trees.push(arg);
        continue;
    }

    rollupArgs.push(arg);
}

const includeBuild = (env, buildType, moduleFormat, bundleState) => {
    return env === null ||
        env === buildType ||
        env === moduleFormat ||
        env === bundleState ||
        env === `${moduleFormat}:${buildType}` ||
        env === `${moduleFormat}:${bundleState}` ||
        env === `${buildType}:${bundleState}` ||
        env === `${moduleFormat}:${buildType}:${bundleState}`;
};

const getTasks = (env) => {
    const tasks = new Set();

    for (const buildType of BUILD_TYPES) {
        for (const moduleFormat of MODULE_FORMAT) {
            for (const bundleState of BUNDLE_STATES) {
                if (bundleState === 'unbundled' && moduleFormat === 'umd') {
                    continue;
                }
                if (bundleState === 'unbundled' && buildType === 'min') {
                    continue;
                }
                if (!includeBuild(env, buildType, moduleFormat, bundleState)) {
                    continue;
                }

                if (buildType === 'min') {
                    tasks.add(`target:min:${moduleFormat}`);
                } else if (moduleFormat === 'umd') {
                    tasks.add(`target:${buildType}:umd`);
                } else if (bundleState === 'unbundled') {
                    tasks.add(`target:${buildType}:esm:unbundled`);
                } else {
                    tasks.add(`target:${buildType}:esm`);
                }
            }
        }
    }

    if (env === null || env === 'types') {
        tasks.add('target:types');
    }

    return Array.from(tasks);
};

const run = (cmd, args) => {
    const res = spawnSync(cmd, args, {
        shell: process.platform === 'win32',
        stdio: 'inherit'
    });
    if (res.error) {
        console.error(res.error.message);
    }
    process.exit(res.status ?? 1);
};

const bin = name => path.join(BIN_DIR, process.platform === 'win32' ? `${name}.cmd` : name);
const info = rollupArgs.includes('-h') ||
    rollupArgs.includes('--help') ||
    rollupArgs.includes('-v') ||
    rollupArgs.includes('--version');

const runRollup = () => {
    const env = [];
    if (target !== null) {
        env.push(`target:${target}`);
    }
    env.push(...trees);

    const args = ['-c', ...rollupArgs];
    for (const item of env) {
        args.push('--environment', item);
    }
    if (watch) {
        args.push('-w');
    }

    run(bin('rollup'), args);
};

if (target === null && !info && fs.existsSync('build')) {
    fs.rmSync('build', { recursive: true });
}

// rollup-specific options and visualizers keep the legacy single-process path.
if (trees.length || rollupArgs.length) {
    runRollup();
}

const tasks = getTasks(target);
if (!tasks.length) {
    runRollup();
}

run(bin('turbo'), [
    watch ? 'watch' : 'run',
    ...tasks,
    ...TURBO_ARGS
]);
