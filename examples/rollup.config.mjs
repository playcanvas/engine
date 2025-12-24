import fs from 'fs';
import path from 'path';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

import { exampleMetaData } from './cache/metadata.mjs';
import { copy } from './utils/plugins/rollup-copy.mjs';
import { isModuleWithExternalDependencies } from './utils/utils.mjs';
import { treeshakeIgnore } from '../utils/plugins/rollup-treeshake-ignore.mjs';
import { buildJSOptions, buildTypesOption } from '../utils/rollup-build-target.mjs';
import { version } from '../utils/rollup-version-revision.mjs';
import { buildHtml } from './utils/plugins/rollup-build-html.mjs';
import { buildShare } from './utils/plugins/rollup-build-share.mjs';
import { removePc } from './utils/plugins/rollup-remove-pc.mjs';

/** @import { RollupOptions } from 'rollup' */

const NODE_ENV = process.env.NODE_ENV ?? '';
const ENGINE_PATH = !process.env.ENGINE_PATH && NODE_ENV === 'development' ?
    '../src/index.js' : process.env.ENGINE_PATH ?? '';

/**
 * Rollup option for static files.
 *
 * @param {object} item - The static files.
 * @param {string} item.src - The source directory.
 * @param {string} item.dest - The destination directory.
 * @param {boolean} [item.once] - Copy only once.
 * @returns {RollupOptions} - The rollup option.
 */
const staticRollupOption = (item) => {
    return {
        input: 'templates/placeholder.html',
        output: {
            file: 'cache/output.tmp'
        },
        watch: {
            skipWrite: true
        },
        treeshake: false,
        plugins: [
            copy([item], NODE_ENV === 'development')
        ]
    };
};

const STATIC_TARGETS = [
    // static main page src
    { src: './src/static', dest: 'dist/' },

    // static iframe src
    { src: './iframe', dest: 'dist/iframe' },

    // assets used in examples
    { src: './assets', dest: 'dist/static/assets/' },

    // thumbnails used in examples
    { src: './thumbnails', dest: 'dist/thumbnails/' },

    // external libraries used in examples
    { src: './src/lib', dest: 'dist/static/lib/' },

    // engine scripts
    { src: '../scripts', dest: 'dist/static/scripts/' },

    // playcanvas observer
    {
        src: './node_modules/@playcanvas/observer/dist/index.mjs',
        dest: 'dist/iframe/playcanvas-observer.mjs'
    },

    // monaco loader
    { src: './node_modules/monaco-editor/min/vs', dest: 'dist/modules/monaco-editor/min/vs' },

    // fflate (for when using ENGINE_PATH)
    { src: '../node_modules/fflate/esm/', dest: 'dist/modules/fflate/esm' }
].map(item => staticRollupOption(item));

const EXAMPLE_TARGETS = exampleMetaData.flatMap(({ categoryKebab, exampleNameKebab, path }) => {
    /** @type {RollupOptions[]} */
    const options = [];

    const name = `${categoryKebab}_${exampleNameKebab}`;
    const dir = fs.readdirSync(path);
    const files = [];
    for (let i = 0; i < dir.length; i++) {
        const file = dir[i];
        if (!file.startsWith(`${exampleNameKebab}.`)) {
            continue;
        }
        files.push(file.replace(`${exampleNameKebab}.`, ''));
    }
    if (!files.includes('controls.mjs')) {
        files.push('controls.mjs');
    }

    fs.mkdirSync('dist/iframe', { recursive: true });
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const input = `${path}/${exampleNameKebab}.${file}`;
        const output = `dist/iframe/${name}.${file}`;
        if (file === 'controls.mjs') {
            options.push({
                input: fs.existsSync(input) ? input : 'templates/controls.mjs',
                output: {
                    file: output,
                    format: 'esm'
                },
                context: 'this',
                external: [
                    'playcanvas',
                    'examples/files',
                    'examples/observer',
                    'examples/utils',
                    /^https?:\/\/.+/
                ],
                plugins: [
                    removePc(),
                    NODE_ENV === 'production' && buildShare({
                        categoryKebab,
                        exampleNameKebab
                    })
                ]
            });
            continue;
        }

        if (file === 'example.mjs') {
            options.push({
                input,
                output: {
                    file: output,
                    format: 'esm'
                },
                context: 'this',
                external: [
                    'playcanvas',
                    'examples/files',
                    'examples/observer',
                    'examples/utils',
                    /^https?:\/\/.+/
                ],
                plugins: [
                    removePc(),
                    buildHtml({
                        categoryKebab,
                        exampleNameKebab,
                        files,
                        engineType: ENGINE_PATH ?
                            'development' : NODE_ENV === 'development' ?
                                'debug' : undefined
                    })
                ]
            });
            continue;
        }

        if (/\.(?:mjs|js)$/.test(file)) {
            options.push({
                input,
                output: {
                    file: output,
                    format: 'esm'
                },
                context: 'this',
                external: [
                    'playcanvas',
                    /^https?:\/\/.+/
                ]
            });
            continue;
        }

        options.push(staticRollupOption({
            src: input,
            dest: output
        }));
    }
    return options;
});

const ENGINE_TARGETS = (() => {
    /** @type {RollupOptions[]} */
    const options = [];

    // Types
    // Outputs: dist/iframe/playcanvas.d.ts
    options.push(buildTypesOption({
        root: '..',
        dir: 'dist/iframe'
    }));

    // Sources
    if (ENGINE_PATH) {
        const src = path.resolve(ENGINE_PATH);
        const content = fs.readFileSync(src, 'utf8');
        const isUnpacked = isModuleWithExternalDependencies(content);

        if (isUnpacked) {
            options.push(staticRollupOption({
                src: path.dirname(src),
                dest: 'dist/iframe/ENGINE_PATH'
            }));
        } else {
            options.push(staticRollupOption({
                src,
                dest: 'dist/iframe/ENGINE_PATH/index.js'
            }));
        }
        return options;
    }

    // Builds
    if (NODE_ENV === 'production') {
        // Outputs: dist/iframe/playcanvas.mjs
        options.push(
            ...buildJSOptions({
                moduleFormat: 'esm',
                buildType: 'release',
                bundleState: 'bundled',
                input: '../src/index.js',
                dir: 'dist/iframe'
            })
        );
    }
    if (NODE_ENV === 'production' || NODE_ENV === 'development') {
        // Outputs: dist/iframe/playcanvas.dbg.mjs
        options.push(
            ...buildJSOptions({
                moduleFormat: 'esm',
                buildType: 'debug',
                bundleState: 'bundled',
                input: '../src/index.js',
                dir: 'dist/iframe'
            })
        );
    }
    if (NODE_ENV === 'production' || NODE_ENV === 'profiler') {
        // Outputs: dist/iframe/playcanvas.prf.mjs
        options.push(
            ...buildJSOptions({
                moduleFormat: 'esm',
                buildType: 'profiler',
                bundleState: 'bundled',
                input: '../src/index.js',
                dir: 'dist/iframe'
            })
        );
    }
    return options;
})();

const APP_TARGETS = [{
    // A debug build is ~2.3MB and a release build ~0.6MB
    input: 'src/app/index.mjs',
    output: {
        dir: 'dist',
        format: 'umd'
    },
    treeshake: 'smallest',
    onwarn(warning, warn) {
        // Suppress "use client" directive warnings from react-router v7+.
        // These directives are for React Server Components which we don't use.
        // The directive is safely ignored and has no effect on client-only builds.
        // This can be removed if Rollup adds native support for "use client" directives,
        // or if we switch to a bundler that supports them (e.g., Vite, webpack 5+).
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) {
            return;
        }
        warn(warning);
    },
    plugins: [
        commonjs(),
        treeshakeIgnore([/@playcanvas\/pcui/g]), // ignore PCUI treeshake
        resolve(),
        replace({
            values: {
                'process.env.NODE_ENV': JSON.stringify(NODE_ENV), // for REACT bundling
                'process.env.VERSION': JSON.stringify(version) // for VERSION in constants.mjs
            },
            preventAssignment: true
        }),
        // @ts-ignore
        NODE_ENV === 'production' && terser()
    ]
}];

export default [
    ...STATIC_TARGETS,
    ...EXAMPLE_TARGETS,
    ...ENGINE_TARGETS,
    ...APP_TARGETS
];
