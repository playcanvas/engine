import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'vite';

import { revision, version } from '../utils/rollup-version-revision.mjs';
import { examplesDevServer } from './utils/vite-dev-server.mjs';

const HOST = process.env.EXAMPLES_HOST ?? '0.0.0.0';
const PORT = Number(process.env.EXAMPLES_PORT ?? 5555);
const AUTO_RELOAD = process.env.EXAMPLES_AUTO_RELOAD !== 'false';

const CERT_DIR = path.resolve('.cert');
const CERT_FILE = path.join(CERT_DIR, 'dev-cert.pem');
const KEY_FILE = path.join(CERT_DIR, 'dev-key.pem');

const httpsConfig = () => {
    if (process.env.EXAMPLES_HTTPS !== '1') return undefined;
    if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
        throw new Error(
            `HTTPS dev requested but certs not found in ${CERT_DIR}. ` +
            'Run "npm run cert" to generate them.'
        );
    }
    return {
        cert: fs.readFileSync(CERT_FILE),
        key: fs.readFileSync(KEY_FILE)
    };
};

const ALLOWED_HOSTS = ['localhost', '.local'];

const examplesPreviewServer = () => ({
    name: 'playcanvas-examples-preview-server',

    configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
            const url = new URL(req.url ?? '/', 'http://localhost');
            if (url.pathname === '/') {
                req.url = `/index.html${url.search}`;
            } else if (url.pathname.startsWith('/share/') && !path.extname(url.pathname)) {
                req.url = `${url.pathname.replace(/\/$/, '')}/index.html${url.search}`;
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
        hmr: AUTO_RELOAD ? undefined : false,
        host: HOST,
        port: PORT,
        https: httpsConfig(),
        // LAN device testing — e.g. https://<hostname>.local:5555
        allowedHosts: ALLOWED_HOSTS,
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
        port: PORT,
        https: httpsConfig(),
        allowedHosts: ALLOWED_HOSTS
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
        'process.env.VERSION': JSON.stringify(version),
        'process.env.REVISION': JSON.stringify(revision)
    },
    plugins: [
        examplesDevServer({ hmr: AUTO_RELOAD }),
        examplesPreviewServer()
    ]
});
