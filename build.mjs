/**
 * Build helper scripts
 * Usage: node build.mjs [options]
 *
 * Options:
 * --type - Specify the build type: std, dbg, prf, min, types.
 * --format - Specify the module format: esm, umd.
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

const JS_TYPES = /** @type {const} */ (['std', 'dbg', 'prf', 'min']);
const BUILD_TYPES = /** @type {const} */ ([...JS_TYPES, 'types']);
const MODULE_FORMATS = /** @type {const} */ (['umd', 'esm']);

const TREE_FLAGS = ['treemap', 'treenet', 'treesun', 'treeflame'];
const BIN_DIR = path.join('node_modules', '.bin');
const USAGE = `Usage: node build.mjs [options]

Options:
  --type <std|dbg|prf|min|types> (default: std)
  --format <esm|umd> (default: esm)
  --watch, -w
  --sourcemaps, -m
  --treemap, --treenet, --treesun, --treeflame

Use npm run build or turbo run build:all for aggregate builds.`;

const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
        type: { type: 'string' },
        format: { type: 'string' },
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

const type = values.type ?? 'std';
const format = values.format ?? 'esm';
const trees = TREE_FLAGS.filter(flag => values[flag]);

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
    if (!BUILD_TYPES.includes(type)) {
        fail(`--type must be one of: ${BUILD_TYPES.join(', ')}`);
    }

    if (values.format && !MODULE_FORMATS.includes(format)) {
        fail(`--format must be one of: ${MODULE_FORMATS.join(', ')}`);
    }

    if (trees.length && type !== 'std') {
        fail('tree visualizers only support --type=std');
    }

    if (type === 'types') {
        if (values.format) {
            fail('--type=types cannot be combined with --format');
        }
        return 'build:types';
    }

    if (type === 'min') {
        return `build:${format}:min:bundled,bundleSource:std`;
    }

    return `build:${format}:${type}${format === 'umd' ? ':bundled' : ''}`;
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
