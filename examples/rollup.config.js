import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from '@rollup/plugin-replace';
import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy';
import { terser } from 'rollup-plugin-terser';
import { string } from 'rollup-plugin-string';
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

export default {
    input: 'src/app/index.tsx',
    output: {
        dir: 'dist',
        format: 'es'
    },
    plugins: [
        string({
            include: '**/*.d.ts'
        }),
        copy({
            targets: [
                { src: 'src/static/*', dest: 'dist/' },
                { src: './assets/*', dest: 'dist/static/assets/' },
                { src: './src/lib/*', dest: 'dist/static/lib/' },
                { src: '../scripts/*', dest: 'dist/static/scripts/' }
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
};
