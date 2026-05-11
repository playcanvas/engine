/**
 * Build helper scripts
 * Usage: node build.mjs [options]
 *
 * Options:
 * --type - Specify the build type: rel, dbg, prf, min, types.
 * --format - Specify the module format: esm, umd.
 * --watch - Rebuild the Rollup leaf build when inputs change.
 * --sourcemaps - Build with source maps using Rollup directly.
 * --clean - Remove build output.
 *
 * --treemap - Enable treemap build visualization (rel only).
 * --treenet - Enable treenet build visualization (rel only).
 * --treesun - Enable treesun build visualization (rel only).
 * --treeflame - Enable treeflame build visualization (rel only).
 */

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, stripVTControlCharacters } from 'node:util';

const JS_TYPES = /** @type {const} */ (['rel', 'dbg', 'prf', 'min']);
const BUILD_TYPES = /** @type {const} */ ([...JS_TYPES, 'types']);
const MODULE_FORMATS = /** @type {const} */ (['umd', 'esm']);

const TREE_FLAGS = ['treemap', 'treenet', 'treesun', 'treeflame'];
const BIN_DIR = path.join('node_modules', '.bin');
const USAGE = `Usage: node build.mjs [options]

Options:
  --type <rel|dbg|prf|min|types> (default: rel)
  --format <esm|umd> (default: esm, tree visualizers default to both)
  --watch, -w
  --sourcemaps, -m
  --clean
  --treemap, --treenet, --treesun, --treeflame

Use npm run build or turbo run build:all for aggregate builds.`;

const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
        type: { type: 'string' },
        format: { type: 'string' },
        watch: { type: 'boolean', short: 'w' },
        sourcemaps: { type: 'boolean', short: 'm' },
        clean: { type: 'boolean' },
        treemap: { type: 'boolean' },
        treenet: { type: 'boolean' },
        treesun: { type: 'boolean' },
        treeflame: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: false
});

const hasType = values.type !== undefined;
const type = values.type ?? 'rel';
const hasFormat = values.format !== undefined;
const format = values.format ?? 'esm';
const trees = TREE_FLAGS.filter(flag => values[flag]);

const pipe = (input, output) => {
    let text = '';
    let style = '';
    input.setEncoding('utf8');
    input.on('data', (chunk) => {
        text += chunk.replace(/\r/g, '\n');
        const lines = text.split('\n');
        text = lines.pop();
        for (const line of lines) {
            const raw = line.trimEnd();
            const out = stripVTControlCharacters(line).trimEnd();
            if (out.trim()) {
                output.write(`${style}${raw}\n`);
                style = '';
            } else if (raw) {
                style += raw;
            }
        }
    });
    input.on('end', () => {
        const raw = text.trimEnd();
        const out = stripVTControlCharacters(text).trimEnd();
        if (out.trim()) {
            output.write(`${style}${raw}\n`);
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

    if (hasFormat && !MODULE_FORMATS.includes(format)) {
        fail(`--format must be one of: ${MODULE_FORMATS.join(', ')}`);
    }

    if (trees.length && type !== 'rel') {
        fail('tree visualizers only support --type=rel');
    }

    if (values.watch && !hasType && !hasFormat) {
        return null;
    }

    if ((values.watch || trees.length) && !hasFormat) {
        return `build:${type}`;
    }

    if (type === 'types') {
        if (values.format) {
            fail('--type=types cannot be combined with --format');
        }
        return 'build:types';
    }

    return `build:${format}:${type}`;
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
        args.push('-w', '--no-watch.clearScreen');
    }

    return run(bin('rollup'), args);
};

if (values.help) {
    console.log(USAGE);
    process.exit(0);
}

if (values.clean) {
    await rm('build', { recursive: true, force: true });
    process.exit(0);
}

process.exitCode = await runRollup();
