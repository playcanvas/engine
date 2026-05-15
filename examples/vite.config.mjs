import path from 'node:path';

import { defineConfig } from 'vite';

import { revision, version } from '../utils/rollup-version-revision.mjs';
import { examplesDevServer } from './utils/vite-dev-server.mjs';

export default defineConfig({
    appType: 'custom',
    clearScreen: false,
    publicDir: false,
    server: {
        fs: {
            allow: [
                process.cwd(),
                path.resolve('..')
            ]
        },
        watch: {
            ignored: [
                '**/dist/**'
            ]
        }
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
        'process.env.VERSION': JSON.stringify(version),
        'process.env.REVISION': JSON.stringify(revision)
    },
    plugins: [
        examplesDevServer()
    ]
});
