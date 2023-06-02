import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import replace from '@rollup/plugin-replace';
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import alias from '@rollup/plugin-alias';
import date from 'date-and-time';
import path from 'path';
import fs from 'fs';
import fse from 'fs-extra';

const ENGINE_PATH = process.env.ENGINE_PATH ? path.resolve(process.env.ENGINE_PATH) : path.resolve('../build/playcanvas.js');
const PCUI_PATH = process.env.PCUI_PATH || 'node_modules/@playcanvas/pcui';
const PCUI_REACT_PATH = path.resolve(PCUI_PATH, 'react');
const PCUI_STYLES_PATH = path.resolve(PCUI_PATH, 'styles');

const staticFiles = [
    { src: 'src/static', dest: 'dist/' },
    { src: './assets', dest: 'dist/static/assets/' },
    { src: './src/lib', dest: 'dist/static/lib/' },
    { src: '../scripts', dest: 'dist/static/scripts/' },
    { src: '../build/playcanvas.d.ts', dest: 'dist/playcanvas.d.ts' },
    { src: 'src/iframe/index.html', dest: 'dist/iframe/index.html' }
];

function timestamp() {
    return {
        name: 'timestamp',
        writeBundle() {
            console.log("\x1b[32m", "Finished at: " + date.format(new Date(), 'HH:mm:ss'));
        }
    };
}

function copyStaticFiles(targets) {
    function watch(src) {
        const srcStats = fs.statSync(src);
        if (srcStats.isFile()) {
            this.addWatchFile(path.resolve(__dirname, src));
            return;
        }

        const filesToWatch = fs.readdirSync(src);

        for (const file of filesToWatch) {
            const fullPath = path.join(src, file);
            const stats = fs.statSync(fullPath);

            if (stats.isFile()) {
                this.addWatchFile(path.resolve(__dirname, fullPath));

            } else if (stats.isDirectory()) {
                watch.bind(this)(fullPath);
            }
        }
    }
    return {
        name: 'copy-and-watch',
        async load() {
            return 'console.log("This temp file is created when copying static files, it should be removed during the build process.");';
        },
        async buildStart() {
            if (process.env.NODE_ENV !== 'development') return;
            targets.forEach((target) => {
                watch.bind(this)(target.src, target.dest);
            });
        },
        async generateBundle() {
            targets.forEach((target) => {
                fse.copySync(target.src, target.dest, { overwrite: true });
            });
        },
        async writeBundle() {
            fs.unlinkSync('dist/copy.tmp');
        }
    };
}

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
            (process.env.NODE_ENV === 'production' && terser()),
            timestamp()
        ]
    },
    {
        // use glob in the input
        input: 'src/iframe/index.mjs',
        output: {
            name: 'bundle',
            format: 'umd',
            dir: 'dist/iframe',
            sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
        },
        plugins: [
            alias({
                entries: {
                    'playcanvas': ENGINE_PATH,
                    '../../../build/playcanvas.js': ENGINE_PATH
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
            }),
            timestamp()
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
                '@playcanvas/observer': 'observer',
                [process.cwd().slice(0, process.cwd().length - 9)]: 'pc'
            }
        },
        plugins: [
            commonjs(),
            resolve(),
            typescript({
                tsconfig: 'tsconfig.json'
            }),
            timestamp()
        ]
    },
    {
        input: 'src/static/index.html',
        output: {
            file: `dist/copy.tmp`
        },
        plugins: [
            copyStaticFiles(staticFiles),
            timestamp()
        ]
    }
];

export default builds;
