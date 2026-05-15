import path from 'node:path';

import { defineConfig } from 'vite';

import { revision, version } from '../utils/rollup-version-revision.mjs';
import { examplesDevServer } from './utils/vite-dev-server.mjs';

const HOST = process.env.EXAMPLES_HOST ?? '0.0.0.0';
const PORT = Number(process.env.EXAMPLES_PORT ?? 5555);

const examplesPreviewServer = () => ({
    name: 'playcanvas-examples-preview-server',

    configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
            if (new URL(req.url ?? '/', 'http://localhost').pathname === '/') {
                req.url = '/index.html';
            }
            next();
        });
    }
});

export default defineConfig({
    appType: 'custom',
    clearScreen: false,
    publicDir: false,
    server: {
        host: HOST,
        port: PORT,
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
    preview: {
        host: HOST,
        port: PORT
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
        'process.env.VERSION': JSON.stringify(version),
        'process.env.REVISION': JSON.stringify(revision)
    },
    plugins: [
        examplesDevServer(),
        examplesPreviewServer()
    ]
});
