import esbuild from 'esbuild';
import fs from 'fs';
import {
    dirname, join as pathJoin, relative as pathRelative,
    resolve as pathResolve, posix, sep
} from 'path';
import { fileURLToPath } from 'url';

import { importValidationPlugin } from './plugins/esbuild-import-validation.mjs';
import {
    applyTransforms, buildStripPattern, transformPipelinePlugin
} from './plugins/esbuild-transform-pipeline.mjs';
import { version, revision } from './rollup-version-revision.mjs';
import { getBanner } from './rollup-get-banner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = pathResolve(__dirname, '..');

const STRIP_FUNCTIONS = [
    'Debug.assert',
    'Debug.assertDeprecated',
    'Debug.assertDestroyed',
    'Debug.call',
    'Debug.deprecated',
    'Debug.warn',
    'Debug.warnOnce',
    'Debug.error',
    'Debug.errorOnce',
    'Debug.log',
    'Debug.logOnce',
    'Debug.removed',
    'Debug.trace',
    'DebugHelper.setName',
    'DebugHelper.setLabel',
    'DebugHelper.setDestroyed',
    'DebugGraphics.toString',
    'DebugGraphics.clearGpuMarkers',
    'DebugGraphics.pushGpuMarker',
    'DebugGraphics.popGpuMarker',
    'WebgpuDebug.validate',
    'WebgpuDebug.memory',
    'WebgpuDebug.internal',
    'WebgpuDebug.end',
    'WebgpuDebug.endShader',
    'WorldClustersDebug.render'
];

const BANNER = {
    debug: ' (DEBUG)',
    release: ' (RELEASE)',
    profiler: ' (PROFILE)',
    min: ' (RELEASE)'
};

const OUT_PREFIX = {
    debug: 'playcanvas.dbg',
    release: 'playcanvas',
    profiler: 'playcanvas.prf',
    min: 'playcanvas.min'
};

/**
 * Get JSCC values for a given build type.
 *
 * @param {'debug'|'release'|'profiler'} buildType - The build type.
 * @returns {{ values: Object<string, string|number>, keepLines: boolean }} JSCC config.
 */
function getJSCCConfig(buildType) {
    const base = {
        _CURRENT_SDK_VERSION: version,
        _CURRENT_SDK_REVISION: revision
    };

    switch (buildType) {
        case 'debug':
            return {
                values: { ...base, _DEBUG: 1, _PROFILER: 1 },
                keepLines: true
            };
        case 'profiler':
            return {
                values: { ...base, _PROFILER: 1 },
                keepLines: false
            };
        case 'release':
        default:
            return { values: base, keepLines: false };
    }
}

/**
 * Collect all .js files under a directory recursively.
 *
 * @param {string} dirPath - Directory to scan.
 * @returns {string[]} List of file paths.
 */
function collectJSFiles(dirPath) {
    const files = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const full = pathJoin(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectJSFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(full);
        }
    }
    return files;
}

/**
 * Build a bundled JS target (single output file).
 *
 * @param {object} options - Build options.
 * @param {'umd'|'esm'} options.moduleFormat - The module format.
 * @param {'debug'|'release'|'profiler'|'min'} options.buildType - The build type.
 * @param {string} [options.input] - Entry point (default: 'src/index.js').
 * @param {string} [options.dir] - Output directory (default: 'build').
 * @returns {Promise<void>}
 */
async function buildBundled({
    moduleFormat,
    buildType,
    input = 'src/index.js',
    dir = 'build'
}) {
    const isUMD = moduleFormat === 'umd';
    const isDebug = buildType === 'debug';
    const isMin = buildType === 'min';
    const prefix = OUT_PREFIX[buildType];
    const outfile = `${dir}/${prefix}${isUMD ? '.js' : '.mjs'}`;
    const effectiveBuildType = buildType === 'min' ? 'release' : buildType;
    const jsccConfig = getJSCCConfig(effectiveBuildType);

    const banner = getBanner(BANNER[buildType]);

    const plugins = [
        transformPipelinePlugin({
            jsccValues: jsccConfig.values,
            jsccKeepLines: jsccConfig.keepLines,
            stripFunctions: !isDebug ? STRIP_FUNCTIONS : null,
            processShaders: !isDebug,
            dynamicImportLegacy: isUMD,
            dynamicImportSuppress: !isUMD
        })
    ];

    if (isDebug) {
        plugins.push(importValidationPlugin(input));
    }

    /** @type {import('esbuild').BuildOptions} */
    const opts = {
        entryPoints: [input],
        bundle: true,
        outfile,
        format: isUMD ? 'iife' : 'esm',
        globalName: isUMD ? 'pc' : undefined,
        target: 'es2020',
        sourcemap: isDebug ? 'inline' : false,
        minify: isMin,
        legalComments: 'none',
        banner: { js: banner },
        plugins,
        external: ['node:worker_threads'],
        logLevel: 'warning'
    };

    if (isMin) {
        opts.drop = ['console'];
    }

    if (isUMD) {
        opts.banner = {
            js: [
                banner,
                '(function (root, factory) {',
                '\tif (typeof module !== \'undefined\' && module.exports) {',
                '\t\tmodule.exports = factory();',
                '\t} else {',
                '\t\troot.pc = factory();',
                '\t}',
                '}(typeof self !== \'undefined\' ? self : this, function () {'
            ].join('\n')
        };
        opts.footer = {
            js: 'return pc;\n}));'
        };
        opts.format = 'esm';
    }

    await esbuild.build(opts);
}

/**
 * Build an unbundled JS target (per-file transform, preserving module structure).
 *
 * @param {object} options - Build options.
 * @param {'debug'|'release'|'profiler'} options.buildType - The build type.
 * @param {string} [options.input] - Entry point directory root (default: 'src').
 * @param {string} [options.dir] - Output base directory (default: 'build').
 * @returns {Promise<void>}
 */
async function buildUnbundled({
    buildType,
    input = 'src',
    dir = 'build'
}) {
    const isDebug = buildType === 'debug';
    const prefix = OUT_PREFIX[buildType];
    const outDir = `${dir}/${prefix}`;
    const effectiveBuildType = buildType === 'min' ? 'release' : buildType;
    const jsccConfig = getJSCCConfig(effectiveBuildType);
    const stripPattern =
        !isDebug ? buildStripPattern(STRIP_FUNCTIONS) : null;

    const srcFiles = collectJSFiles(input);

    const transformPromises = srcFiles.map(async (srcFile) => {
        let source = await fs.promises.readFile(srcFile, 'utf8');

        source = applyTransforms(source, {
            jsccValues: jsccConfig.values,
            jsccKeepLines: jsccConfig.keepLines,
            stripPattern,
            processShaders: !isDebug,
            dynamicImportLegacy: false,
            dynamicImportSuppress: true
        });

        // Rewrite bare 'fflate' import to relative modules path
        if (source.includes('from \'fflate\'') ||
            source.includes('from "fflate"')) {
            const relFromSrc = pathRelative(dirname(srcFile), input);
            const modulePath = posix.join(
                relFromSrc.split(sep).join('/'),
                '..', 'modules', 'fflate', 'esm', 'browser.js'
            );
            source = source.replace(
                /from ['"]fflate['"]/g,
                `from '${modulePath}'`
            );
        }

        const destFile = pathJoin(outDir, srcFile);
        await fs.promises.mkdir(dirname(destFile), { recursive: true });
        await fs.promises.writeFile(destFile, source);
    });

    await Promise.all(transformPromises);

    // Copy fflate module into unbundled output
    const fflateEntry = pathJoin(
        rootDir, 'node_modules', 'fflate', 'esm', 'browser.js'
    );
    const destDir = pathJoin(outDir, 'modules', 'fflate', 'esm');
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(fflateEntry, pathJoin(destDir, 'browser.js'));
}

/**
 * Build a single JS target (bundled or unbundled).
 *
 * @param {object} options - Build options.
 * @param {'umd'|'esm'} options.moduleFormat - The module format.
 * @param {'debug'|'release'|'profiler'|'min'} options.buildType - The build type.
 * @param {'unbundled'|'bundled'} [options.bundleState] - The bundle state.
 * @param {string} [options.input] - Entry point.
 * @param {string} [options.dir] - Output directory.
 * @returns {Promise<void>}
 */
async function buildTarget({
    moduleFormat,
    buildType,
    bundleState,
    input = 'src/index.js',
    dir = 'build'
}) {
    const isUMD = moduleFormat === 'umd';
    const isMin = buildType === 'min';
    const bundled = isUMD || isMin || bundleState === 'bundled';

    if (bundled) {
        await buildBundled({ moduleFormat, buildType, input, dir });
    } else {
        await buildUnbundled({
            buildType, input: dirname(input), dir
        });
    }
}

export { buildTarget, OUT_PREFIX };
