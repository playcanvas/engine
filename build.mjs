/**
 * Build helper scripts
 * Usage: node build.mjs [options]
 *
 * Options:
 * --type - Specify the build type: rel, dbg, prf, min, types.
 * --format - Specify the module format: esm, umd.
 * --watch - Rebuild when inputs change.
 * --sourcemaps - Build with source maps.
 * --clean - Remove build output.
 *
 * --treemap - Enable treemap build visualization (rel only).
 * --treenet - Enable treenet build visualization (rel only).
 * --treesun - Enable treesun build visualization (rel only).
 */

import { spawn } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, stripVTControlCharacters } from 'node:util';

import { buildTarget, OUT_PREFIX, watchTarget } from './utils/esbuild-build-target.mjs';
import { buildTypes, TYPES_INPUT, TYPES_OUTPUT, watchTypes } from './utils/types-build-target.mjs';

const JS_TYPES = /** @type {const} */ (['rel', 'dbg', 'prf', 'min']);
const BUILD_TYPES = /** @type {const} */ ([...JS_TYPES, 'types']);
const MODULE_FORMATS = /** @type {const} */ (['umd', 'esm']);

const INPUT = 'src/index.js';
const TREE_FLAGS = ['treemap', 'treenet', 'treesun'];
const TREE_TEMPLATES = {
    treemap: 'treemap',
    treenet: 'network',
    treesun: 'sunburst'
};
const BIN_DIR = path.join('node_modules', '.bin');
const VISUALIZER = process.platform === 'win32' ? 'esbuild-visualizer.cmd' : 'esbuild-visualizer';
const BOLD = '\x1b[1m';
const REGULAR = '\x1b[22m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[39m';
const COLORS = process.env.FORCE_COLOR !== '0' && !process.env.NO_COLOR;
const USAGE = `Usage: node build.mjs [options]

Options:
  --type <rel|dbg|prf|min|types>
  --format <esm|umd> (required for JS builds, tree visualizers default to both)
  --watch, -w
  --sourcemaps, -m
  --clean
  --treemap, --treenet, --treesun

Tree visualizers default to --type=rel and both formats.
Use npm run build or turbo run build:all for aggregate builds.
Use npm run watch or turbo run watch:all for aggregate watches.`;

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
        help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: false
});

const hasType = values.type !== undefined;
const type = values.type;
const hasFormat = values.format !== undefined;
const format = values.format;
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
                continue;
            }
            if (raw) {
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
    return process.exit(1);
};

const getTreeTargets = () => {
    const buildType = type ?? 'rel';

    if (!BUILD_TYPES.includes(buildType)) {
        return fail(`--type must be one of: ${BUILD_TYPES.join(', ')}`);
    }

    if (buildType !== 'rel') {
        return fail('tree visualizers only support --type=rel');
    }

    if (hasFormat && !MODULE_FORMATS.includes(format)) {
        return fail(`--format must be one of: ${MODULE_FORMATS.join(', ')}`);
    }

    return (hasFormat ? [format] : MODULE_FORMATS).map(moduleFormat => ({
        buildType,
        moduleFormat
    }));
};

const ms = (value) => {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
};

const bold = (value) => {
    return COLORS ? `${BOLD}${value}${REGULAR}` : value;
};

const writeLog = (stream, code, value) => {
    const text = COLORS ? `${code}${value}${RESET}` : value;
    stream.write(`${text}\n`);
};

const startLog = (input, output) => writeLog(process.stderr, CYAN, `${bold(input)} → ${bold(output)}...`);

const createdLog = (output, elapsed) => {
    writeLog(process.stderr, GREEN, `created ${bold(output)} in ${bold(ms(elapsed))}`);
};

const failedLog = (output, elapsed) => {
    writeLog(process.stderr, RED, `failed ${bold(output)} in ${bold(ms(elapsed))}`);
};

const runTreeVisualizers = async (moduleFormat, metafile) => {
    const suffix = moduleFormat === 'esm' ? 'es' : 'umd';
    const metadata = `build/.esbuild-metafile.${moduleFormat}.json`;

    await writeFile(metadata, JSON.stringify(metafile));

    const codes = await Promise.all(trees.map(async (flag) => {
        const output = `${flag}.${suffix}.html`;
        startLog(metadata, output);
        const start = performance.now();
        const code = await run(path.join(BIN_DIR, VISUALIZER), [
            '--metadata', metadata,
            '--filename', output,
            '--template', TREE_TEMPLATES[flag]
        ]);
        if (code) {
            failedLog(output, performance.now() - start);
            return code;
        }
        createdLog(output, performance.now() - start);

        return 0;
    }));
    const code = codes.find(Boolean) ?? 0;
    if (code) {
        return code;
    }

    await rm(metadata, { force: true });

    return 0;
};

const targetOutput = (buildType, moduleFormat) => {
    const prefix = OUT_PREFIX[buildType];
    const file = `build/${prefix}${moduleFormat === 'umd' ? '.js' : '.mjs'}`;
    return moduleFormat === 'esm' && buildType !== 'min' ? `${file}, build/${prefix}/` : file;
};

const buildTreeTarget = async (target) => {
    const output = targetOutput(target.buildType, target.moduleFormat);
    startLog(INPUT, output);
    const start = performance.now();
    const result = await buildTarget({
        ...target,
        sourcemaps: values.sourcemaps,
        metafile: true
    });
    createdLog(output, performance.now() - start);

    return runTreeVisualizers(target.moduleFormat, result.metafile);
};

const buildTrees = async () => {
    const codes = await Promise.all(getTreeTargets().map(target => buildTreeTarget(target)));

    return codes.find(Boolean) ?? 0;
};

const watchTrees = async () => {
    const watchers = await Promise.all(getTreeTargets().map((target) => {
        return watchTarget({
            ...target,
            sourcemaps: values.sourcemaps,
            metafile: true,
            start: startLog,
            log(path, elapsed, errors) {
                if (errors) {
                    failedLog(path, elapsed);
                    return;
                }
                createdLog(path, elapsed);
            },
            end(result) {
                return runTreeVisualizers(target.moduleFormat, result.metafile);
            }
        });
    }));

    return watchers.flat();
};

const getJSTargets = () => {
    if (!hasType) {
        return fail('--type is required');
    }

    if (!BUILD_TYPES.includes(type)) {
        return fail(`--type must be one of: ${BUILD_TYPES.join(', ')}`);
    }

    if (!hasFormat) {
        return fail('--format is required for JS builds');
    }

    if (!MODULE_FORMATS.includes(format)) {
        return fail(`--format must be one of: ${MODULE_FORMATS.join(', ')}`);
    }

    if (type === 'types' && values.format) {
        return fail('--type=types cannot be combined with --format');
    }

    /** @type {{ buildType: 'rel'|'dbg'|'prf'|'min', moduleFormat: 'umd'|'esm' }[]} */
    const targets = [];
    JS_TYPES.forEach((buildType) => {
        MODULE_FORMATS.forEach((moduleFormat) => {
            if (type !== 'types' && !trees.length && buildType === type && moduleFormat === format) {
                targets.push({ buildType, moduleFormat });
            }
        });
    });

    return targets;
};

const buildJS = async () => {
    const targets = getJSTargets();
    if (!targets.length) {
        return 0;
    }

    await Promise.all(targets.map(async (target) => {
        const output = targetOutput(target.buildType, target.moduleFormat);
        startLog(INPUT, output);
        const start = performance.now();
        await buildTarget({
            ...target,
            sourcemaps: values.sourcemaps
        });
        createdLog(output, performance.now() - start);
    }));

    return 0;
};

const watchJS = async () => {
    const targets = getJSTargets();
    if (!targets.length) {
        return [];
    }

    const watchers = await Promise.all(targets.map((target) => {
        return watchTarget({
            ...target,
            sourcemaps: values.sourcemaps,
            start: startLog,
            log(path, elapsed, errors) {
                if (errors) {
                    failedLog(path, elapsed);
                    return;
                }
                createdLog(path, elapsed);
            }
        });
    }));

    return watchers.flat();
};

const buildTypesTarget = async () => {
    if (values.format) {
        return fail('--type=types cannot be combined with --format');
    }

    startLog(TYPES_INPUT, TYPES_OUTPUT);
    const start = performance.now();
    await buildTypes();
    createdLog(TYPES_OUTPUT, performance.now() - start);

    return 0;
};

const watchTypesTarget = () => {
    if (values.format) {
        return fail('--type=types cannot be combined with --format');
    }

    return watchTypes({
        start: startLog,
        log(path, elapsed, errors) {
            if (errors) {
                failedLog(path, elapsed);
                return;
            }
            createdLog(path, elapsed);
        }
    });
};

const main = async () => {
    if (values.help) {
        console.log(USAGE);
        return 0;
    }

    if (values.clean) {
        await rm('build', { recursive: true, force: true });
        return 0;
    }

    if (values.watch && values.sourcemaps && !hasType && !hasFormat && !trees.length) {
        return fail('--sourcemaps cannot be combined with aggregate --watch');
    }

    if (trees.length && values.watch) {
        await watchTrees();
        await new Promise(() => {});
        return 0;
    }

    if (trees.length) {
        return buildTrees();
    }

    if (values.watch && !hasType && !hasFormat) {
        return fail('aggregate watch must be run with npm run watch or turbo run watch:all');
    }

    if (type === 'types' && values.watch) {
        await watchTypesTarget();
        await new Promise(() => {});
        return 0;
    }

    if (type === 'types') {
        return buildTypesTarget();
    }

    if (values.watch) {
        await watchJS();
        await new Promise(() => {});
        return 0;
    }

    return buildJS();
};

process.exitCode = await main();
