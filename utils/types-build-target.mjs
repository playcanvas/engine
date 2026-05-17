import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { rollup } from 'rollup';
import dts from 'rollup-plugin-dts';

import { fixTypes } from './plugins/rollup-types-fixup.mjs';

const BIN_DIR = path.join('node_modules', '.bin');
const TSC_CONFIG = 'tsconfig.build.json';
const TSC_INFO = 'build/.cache/playcanvas-types.tsbuildinfo';
const TYPES_ENTRY = 'build/playcanvas/src/index.d.ts';
const TYPES_DIR = 'build/playcanvas/src';
const TYPES_INPUT = 'src/index.js';
const TYPES_OUTPUT = 'build/playcanvas.d.ts';
const TYPES_FOOTER = 'export as namespace pc;\nexport as namespace pcx;';
const REQUIRED_TYPES = [
    TYPES_ENTRY,
    'build/playcanvas/src/scene/materials/standard-material.d.ts',
    'build/playcanvas/src/framework/script/script-type.d.ts'
];

const exists = (file) => {
    return fs.promises.stat(file).then(() => true, () => false);
};

const latestTypesMtime = async (dir) => {
    const stat = await fs.promises.stat(dir).then(value => value, () => null);
    if (!stat) {
        return 0;
    }
    if (stat.isFile()) {
        return dir.endsWith('.d.ts') ? stat.mtimeMs : 0;
    }

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const times = await Promise.all(entries.map((entry) => {
        return latestTypesMtime(path.join(dir, entry.name));
    }));

    return Math.max(stat.mtimeMs, ...times);
};

const runTsc = (root) => {
    return new Promise((resolve, reject) => {
        const cmd = path.join(BIN_DIR, process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
        const child = spawn(cmd, ['--project', path.join(root, TSC_CONFIG)], {
            shell: process.platform === 'win32',
            stdio: 'inherit'
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code) {
                reject(new Error(`tsc failed with code ${code}`));
                return;
            }
            resolve();
        });
    });
};

const emitTypes = async (root) => {
    const found = await Promise.all(REQUIRED_TYPES.map((file) => {
        return exists(path.join(root, file));
    }));
    if (found.some(value => !value)) {
        await fs.promises.rm(path.join(root, TSC_INFO), { force: true });
    }
    await runTsc(root);
};

const bundleTypes = async (root, dir) => {
    await fs.promises.mkdir(dir, { recursive: true });
    const opts = {
        input: path.join(root, TYPES_ENTRY),
        output: [{
            file: path.join(dir, 'playcanvas.d.ts'),
            footer: TYPES_FOOTER,
            format: 'es'
        }],
        plugins: [
            dts()
        ]
    };
    const bundle = await rollup(opts);
    await bundle.write(opts.output[0]);
    await bundle.close();
};

const buildTypes = async ({
    root = '.',
    dir = 'build',
    skipUnchanged = false
} = {}) => {
    const src = path.join(root, TYPES_DIR);
    const output = path.join(dir, 'playcanvas.d.ts');
    const before = skipUnchanged ? await latestTypesMtime(src) : 0;

    await emitTypes(root);

    const after = skipUnchanged ? await latestTypesMtime(src) : 1;
    const dirty = !skipUnchanged || !await exists(output) || after > before;
    if (dirty) {
        fixTypes(root);
        await bundleTypes(root, dir);
    }

    return {
        bundled: dirty
    };
};

const watchTypes = async ({
    root = '.',
    dir = 'build',
    start,
    log
}) => {
    const output = path.join(dir, 'playcanvas.d.ts');
    let active = false;
    let pending = false;
    let initial = true;
    let timer = null;

    const run = () => {
        start(TYPES_INPUT, output);
        const time = performance.now();
        const skipUnchanged = !initial;
        initial = false;
        return buildTypes({
            root,
            dir,
            skipUnchanged
        }).then(() => {
            log(output, performance.now() - time, 0);
        }, (err) => {
            console.error(err.message);
            log(output, performance.now() - time, 1);
        });
    };

    const rebuild = () => {
        if (active) {
            pending = true;
            return;
        }

        active = true;
        run().then(() => {
            active = false;
            if (pending) {
                pending = false;
                rebuild();
            }
        });
    };

    await run();

    const watcher = fs.watch(path.join(root, 'src'), { recursive: true }, (event, file) => {
        if (!file?.endsWith('.js')) {
            return;
        }
        clearTimeout(timer);
        timer = setTimeout(rebuild, 100);
    });

    return {
        dispose() {
            clearTimeout(timer);
            watcher.close();
        }
    };
};

export { buildTypes, TYPES_INPUT, TYPES_OUTPUT, watchTypes };
