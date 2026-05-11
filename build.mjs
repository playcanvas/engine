/**
 * Build helper scripts
 * Usage: node build.mjs [options]
 *
 * Options:
 * --std, --dbg, --prf, --min, --types - Specify the build type.
 * --umd, --esm - Specify the module format.
 * --watch - Rebuild the Rollup leaf build when inputs change.
 * --sourcemaps - Build with source maps using Rollup directly.
 *
 * treemap - Enable treemap build visualization (std only).
 * treenet - Enable treenet build visualization (std only).
 * treesun - Enable treesun build visualization (std only).
 * treeflame - Enable treeflame build visualization (std only).
 */

import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs, stripVTControlCharacters } from 'node:util';

const BUILD_TYPES = /** @type {const} */ (['std', 'dbg', 'prf', 'min']);
const MODULE_FORMATS = /** @type {const} */ (['umd', 'esm']);

const TREE_FLAGS = ['treemap', 'treenet', 'treesun', 'treeflame'];
const BIN_DIR = path.join('node_modules', '.bin');
const USAGE = `Usage: node build.mjs [options]

Options:
  --std, --dbg, --prf, --min, --types
  --umd, --esm
  --watch, -w
  --sourcemaps, -m
  --treemap, --treenet, --treesun, --treeflame

Use npm run build or turbo run build:all for aggregate builds.`;

const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
        std: { type: 'boolean' },
        dbg: { type: 'boolean' },
        prf: { type: 'boolean' },
        min: { type: 'boolean' },
        types: { type: 'boolean' },
        umd: { type: 'boolean' },
        esm: { type: 'boolean' },
        watch: { type: 'boolean', short: 'w' },
        sourcemaps: { type: 'boolean', short: 'm' },
        treemap: { type: 'boolean' },
        treenet: { type: 'boolean' },
        treesun: { type: 'boolean' },
        treeflame: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: false
});

const types = BUILD_TYPES.filter(type => values[type]);
const formats = MODULE_FORMATS.filter(format => values[format]);
const trees = TREE_FLAGS.filter(flag => values[flag]);
const treeDefault = trees.length && !types.length && !values.types;
const rollup = values.sourcemaps || trees.length;
const leaf = values.types || (types.length === 1 && formats.length === 1);

const pipe = (input, output) => {
    let text = '';
    input.setEncoding('utf8');
    input.on('data', (chunk) => {
        text += chunk.replace(/\r/g, '\n');
        const lines = text.split('\n');
        text = lines.pop();
        for (const line of lines) {
            const out = stripVTControlCharacters(line).trimEnd();
            if (out.trim()) {
                output.write(`${out}\n`);
            }
        }
    });
    input.on('end', () => {
        const out = stripVTControlCharacters(text).trimEnd();
        if (out.trim()) {
            output.write(`${out}\n`);
        }
    });
};

const run = (cmd, args) => {
    const child = spawn(cmd, args, {
        shell: process.platform === 'win32',
        stdio: values.watch ? 'inherit' : ['inherit', 'pipe', 'pipe']
    });
    if (child.stdout) {
        pipe(child.stdout, process.stdout);
    }
    if (child.stderr) {
        pipe(child.stderr, process.stderr);
    }
    return new Promise((resolve) => {
        child.on('error', (err) => {
            console.error(err.message);
            resolve(1);
        });
        child.on('close', code => resolve(code ?? 1));
    });
};

const fail = (msg) => {
    console.error(msg);
    process.exit(1);
};

const bin = name => path.join(BIN_DIR, process.platform === 'win32' ? `${name}.cmd` : name);

const getRollupBuild = () => {
    if (!leaf && !rollup) {
        fail('Use npm run build, npm run watch, or turbo run build:<task> for aggregate builds');
    }

    if (values.types) {
        if (types.length || formats.length) {
            fail('--types cannot be combined with JS build flags in Rollup mode');
        }
        return 'build:types';
    }

    if (trees.length && types.length && (types.length > 1 || types[0] !== 'std')) {
        fail('tree visualizers only support --std');
    }

    if (types.length > 1 || formats.length > 1) {
        fail('Rollup mode accepts at most one build type and one module format');
    }

    const type = treeDefault ? 'std' : types[0];
    const format = formats[0];

    if (type === 'min' && format) {
        return `build:${format}:min:bundled,bundleSource:std`;
    }
    if (type && format) {
        return `build:${format}:${type}${format === 'umd' ? ':bundled' : ''}`;
    }
    if (type) {
        return `build:${type}`;
    }
    if (format) {
        return `build:${format}`;
    }
    return null;
};

const runRollup = () => {
    const env = [];
    const build = getRollupBuild();
    if (build) {
        env.push(build);
    }
    env.push(...trees);

    const args = ['-c'];
    if (values.sourcemaps) {
        args.push('-m');
    }
    for (const item of env) {
        args.push('--environment', item);
    }
    if (values.watch) {
        args.push('-w');
    }

    return run(bin('rollup'), args);
};

if (values.help) {
    console.log(USAGE);
    process.exit(0);
}

process.exitCode = await runRollup();
