import { createServer } from 'node:http';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PC_WEBGL_TEST_PORT ?? 5557);
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
let browser;
let finished = false;
const server = createServer();
const timeout = setTimeout(() => {
    console.error('WebGL2 browser tests timed out');
    finish(1);
}, 120000);

/**
 * @param {number} code - Process exit status.
 */
function finish(code) {
    if (finished) return;
    finished = true;
    process.exitCode = code;
    clearTimeout(timeout);
    browser?.kill();
    server.closeAllConnections();
    server.close();
}

const readBody = async (request) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
};

const handleRequest = async (request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (request.method === 'POST' && url.pathname === '/progress') {
        console.log(await readBody(request));
        response.writeHead(200).end('ok');
        return;
    }
    if (request.method === 'POST' && url.pathname === '/results') {
        const result = JSON.parse(await readBody(request));
        if (output) await writeFile(output, JSON.stringify(result, null, 2));
        response.writeHead(200).end('ok');
        console.log(JSON.stringify(result, null, 2));
        finish(result.passed === true ? 0 : 1);
        return;
    }
    const pathname = url.pathname === '/' ? '/test/browser/gsplat-steady-webgl.html' : decodeURIComponent(url.pathname);
    const path = resolve(root, `.${pathname}`);
    const localPath = relative(root, path).split(sep).join('/');
    if (!['src/', 'test/browser/', 'examples/assets/', 'node_modules/fflate/'].some(prefix => localPath.startsWith(prefix))) {
        response.writeHead(404).end();
        return;
    }
    try {
        const data = await readFile(path);
        const contentType = path.endsWith('.html') ? 'text/html' : /\.m?js$/.test(path) ? 'text/javascript' : 'application/octet-stream';
        response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' }).end(data);
    } catch {
        console.error(`Not found: ${pathname}`);
        response.writeHead(404).end();
    }
};

server.on('request', (request, response) => {
    handleRequest(request, response).catch((error) => {
        console.error(error);
        response.writeHead(500).end();
        finish(1);
    });
});
server.on('error', (error) => {
    console.error(error);
    finish(1);
});
process.once('SIGINT', () => finish(130));
process.once('SIGTERM', () => finish(143));

server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`Open ${url} to run the WebGL2 tests.`);
    if (process.env.PC_WEBGL_BROWSER) {
        const profile = mkdtempSync(join(tmpdir(), 'playcanvas-webgl-'));
        browser = spawn(process.env.PC_WEBGL_BROWSER, [
            '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
            `--user-data-dir=${profile}`, url
        ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        browser.stderr.on('data', data => process.stderr.write(data));
        browser.on('error', (error) => {
            console.error(error);
            finish(1);
        });
        browser.on('close', (code) => {
            if (!finished) {
                console.error(`Browser exited before reporting results (exit code ${code})`);
                finish(1);
            }
            const resolvedProfile = resolve(profile);
            if (resolvedProfile.startsWith(`${resolve(tmpdir())}${sep}`) && basename(resolvedProfile).startsWith('playcanvas-webgl-')) {
                rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch((error) => {
                    console.error(error);
                    process.exitCode = 1;
                });
            }
        });
    }
});
