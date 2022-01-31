import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from '@rollup/plugin-replace';
import typescript from 'rollup-plugin-typescript2';
import copy from 'rollup-plugin-copy';
import { terser } from 'rollup-plugin-terser';
import { string } from 'rollup-plugin-string';

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
                { src: '../scripts/*', dest: 'dist/static/scripts/' },
                { src: './src/wasm-loader.js', dest: 'dist/static/' }
            ]
        }),
        commonjs(),
        resolve(),
        typescript(),
        replace({
            values: {
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
            },
            preventAssignment: true
        }),
        (process.env.NODE_ENV === 'production' && terser())
    ]
};
