import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from '@rollup/plugin-replace';
import typescript from 'rollup-plugin-typescript';
import copy from 'rollup-plugin-copy';
import { terser } from 'rollup-plugin-terser';

export default {
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
                { src: './src/wasm-loader.js', dest: 'dist/static/' }
            ]
        }),
        commonjs(),
        resolve(),
        typescript(),
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
        }),
        (process.env.NODE_ENV === 'production' && terser())
    ]
};
