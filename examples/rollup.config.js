import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from '@rollup/plugin-replace';
import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy';
import { terser } from 'rollup-plugin-terser';
import alias from '@rollup/plugin-alias';
import path from 'path';

const PCUI_PATH = process.env.PCUI_PATH || 'node_modules/@playcanvas/pcui';
const PCUI_REACT_PATH = path.resolve(PCUI_PATH, 'react');
const PCUI_STYLES_PATH = path.resolve(PCUI_PATH, 'styles');

// define supported module overrides
const aliasEntries = {
    '@playcanvas/pcui/react': PCUI_REACT_PATH,
    '@playcanvas/pcui/styles': PCUI_STYLES_PATH
};

const tsCompilerOptions = {
    baseUrl: '.',
    paths: {
        '@playcanvas/pcui/react': [PCUI_REACT_PATH],
        '@playcanvas/pcui/styles': [PCUI_STYLES_PATH]
    }
};

const builds = [
    {
        input: 'src/app/index.tsx',
        output: {
            dir: 'dist',
            format: 'es'
        },
        plugins: [
            copy({
                targets: [
                    { src: 'src/static/*', dest: 'dist/' },
                    { src: './assets/*', dest: 'dist/static/assets/' },
                    { src: './src/lib/*', dest: 'dist/static/lib/' },
                    { src: '../scripts/*', dest: 'dist/static/scripts/' },
                    { src: '../build/playcanvas.d.ts', dest: 'dist/' }
                ]
            }),
            alias({ entries: aliasEntries }),
            commonjs(),
            resolve(),
            typescript({
                tsconfig: 'tsconfig.json',
                tsconfigDefaults: { compilerOptions: tsCompilerOptions },
                clean: true
            }),
            replace({
                values: {
                    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
                },
                preventAssignment: true
            }),
            (process.env.NODE_ENV === 'production' && terser())
        ]
    },
    {
        // use glob in the input
        input: 'src/iframe/index.mjs',
        output: {
            name: 'bundle',
            format: 'umd',
            dir: 'dist/iframe'
        },
        plugins: [
            copy({
                targets: [
                    { src: 'src/iframe/index.html', dest: 'dist/iframe' }
                ]
            }),
            alias({
                entries: {
                    'playcanvas': path.resolve('../build/playcanvas.js')
                }
            }),
            commonjs(),
            resolve(),
            replace({
                'process.env.NODE_ENV': JSON.stringify(
                    'production'
                ),
                preventAssignment: true
            }),
            typescript({
                tsconfig: 'tsconfig.json'
            })
        ]
    },
    {
        input: 'src/examples/index.mjs',
        external: ['../../../../', 'react', '@playcanvas/pcui/react', '@playcanvas/observer'],
        output: {
            name: 'examples',
            format: 'umd',
            dir: `dist/examples`,
            globals: {
                '@playcanvas/pcui/react': 'pcui',
                'react': 'React',
                '@playcanvas/observer': 'observer'
            }
        },
        plugins: [
            commonjs(),
            resolve(),
            typescript({
                tsconfig: 'tsconfig.json'
            })
        ]
    }
];

export default builds;
