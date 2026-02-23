import esbuild from 'esbuild';
import fs from 'fs';
import { dirname, resolve as pathResolve, join as pathJoin, relative as pathRelative, posix, sep } from 'path';
import { fileURLToPath } from 'url';

import { processJSCC } from './plugins/esbuild-jscc.mjs';
import { buildStripPattern, applyStrip } from './plugins/esbuild-strip.mjs';
import { processShaderChunks } from './plugins/esbuild-shader-chunks.mjs';
import { applyDynamicImportSuppress } from './plugins/esbuild-dynamic.mjs';
import { importValidationPlugin } from './plugins/esbuild-import-validation.mjs';
import { transformPipelinePlugin } from './plugins/esbuild-transform-pipeline.mjs';
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
            return { values: { ...base, _DEBUG: 1, _PROFILER: 1 }, keepLines: true };
        case 'profiler':
            return { values: { ...base, _PROFILER: 1 }, keepLines: false };
        case 'release':
        default:
            return { values: base, keepLines: false };
    }
}

/**
 * Build esbuild plugins list for a given build configuration.
 * Uses a single combined pipeline plugin for all source transforms (since esbuild
 * only runs the first matching onLoad handler per file).
 *
 * @param {object} opts - Build options.
 * @param {'debug'|'release'|'profiler'|'min'} opts.buildType - The build type.
 * @param {boolean} opts.isUMD - Whether this is a UMD (IIFE) build.
 * @param {string} opts.input - Entry point path.
 * @returns {import('esbuild').Plugin[]} Plugins array.
 */
function getPlugins({ buildType, isUMD, input }) {
    const isDebug = buildType === 'debug';
    const effectiveBuildType = buildType === 'min' ? 'release' : buildType;
    const jsccConfig = getJSCCConfig(effectiveBuildType);

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

    return plugins;
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

    const banner = getBanner(BANNER[buildType]);

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
        plugins: getPlugins({ buildType, isUMD, input }),
        external: ['node:worker_threads'],
        logLevel: 'warning'
    };

    if (isMin) {
        opts.drop = ['console'];
    }

    if (isUMD) {
        // Wrap IIFE output with a UMD detection header
        opts.banner = {
            js: `${banner}\n(function (root, factory) {\n\tif (typeof module !== 'undefined' && module.exports) {\n\t\tmodule.exports = factory();\n\t} else {\n\t\troot.pc = factory();\n\t}\n}(typeof self !== 'undefined' ? self : this, function () {`
        };
        opts.footer = {
            js: 'return pc;\n}));'
        };
        // Use 'esm' internally so esbuild doesn't double-wrap, we handle the UMD wrapper ourselves
        opts.format = 'esm';
    }

    await esbuild.build(opts);
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
 * Resolve and copy the fflate module into the unbundled output directory,
 * replicating Rollup's node_modules → modules renaming.
 *
 * @param {string} outDir - Output directory (e.g. 'build/playcanvas').
 */
function copyFflateModule(outDir) {
    const fflateEntry = pathJoin(rootDir, 'node_modules', 'fflate', 'esm', 'browser.js');
    const destDir = pathJoin(outDir, 'modules', 'fflate', 'esm');
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(fflateEntry, pathJoin(destDir, 'browser.js'));
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
    const stripPattern = !isDebug ? buildStripPattern(STRIP_FUNCTIONS) : null;

    const srcFiles = collectJSFiles(input);

    const transformPromises = srcFiles.map(async (srcFile) => {
        let source = await fs.promises.readFile(srcFile, 'utf8');

        // Apply JSCC
        source = processJSCC(source, jsccConfig.values, jsccConfig.keepLines);

        // Apply shader chunks (non-debug)
        if (!isDebug) {
            source = processShaderChunks(source);
        }

        // Apply strip (non-debug)
        if (stripPattern) {
            source = applyStrip(source, stripPattern);
        }

        // Apply dynamic import suppress (always for ESM unbundled)
        source = applyDynamicImportSuppress(source);

        // Rewrite bare 'fflate' import to relative modules path
        if (source.includes('from \'fflate\'') || source.includes('from "fflate"')) {
            const relFromSrc = pathRelative(dirname(srcFile), input);
            const modulePath = posix.join(
                relFromSrc.split(sep).join('/'),
                '..', 'modules', 'fflate', 'esm', 'browser.js'
            );
            source = source.replace(/from ['"]fflate['"]/g, `from '${modulePath}'`);
        }

        const destFile = pathJoin(outDir, srcFile);
        await fs.promises.mkdir(dirname(destFile), { recursive: true });
        await fs.promises.writeFile(destFile, source);
    });

    await Promise.all(transformPromises);

    // Copy fflate module
    copyFflateModule(outDir);
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
        await buildUnbundled({ buildType, input: dirname(input), dir });
    }
}

export { buildTarget, buildBundled, buildUnbundled, OUT_PREFIX, BANNER };
