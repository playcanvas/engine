import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import expect from 'expect';
import { toMatchImageSnapshot } from 'expect-mocha-image-snapshot';
import puppeteer from 'puppeteer';

import { exampleMetaData } from '../cache/metadata.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = join(__dirname, '..');

expect.extend({ toMatchImageSnapshot });

describe('E2E tests', function () {
    let browser;
    let page;
    let serverProcess;

    before(async function () {
        this.timeout(30000);

        // Starting local server
        console.log('Starting local server...');
        serverProcess = spawn('npm', ['run', 'develop'], {
            cwd: examplesDir,
            stdio: 'pipe',
            shell: process.platform === 'win32'
        });

        // Monitoring server output
        const serverReadyPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Server startup timed out'));
            }, 25000);

            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log('Server:', output);
                if (output.includes('Accepting connections at http://localhost:5555')) {
                    clearTimeout(timeout);
                    setTimeout(resolve, 2000); // Wait a bit for the server to fully start
                }
            });

            serverProcess.stderr.on('data', (data) => {
                console.error('Server Error:', data.toString());
            });

            serverProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });

        await serverReadyPromise;

        browser = await puppeteer.launch({ headless: false, devtools: false, defaultViewport: { width: 1920, height: 1080 } });
        page = await browser.newPage();

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    });

    after(async function () {
        await page.close();
        await browser.close();

        // Shutting down local server
        if (serverProcess) {
            console.log('Shutting down local server...');
            serverProcess.kill('SIGTERM');

            // Wait for the process to definitely close
            await new Promise((resolve) => {
                serverProcess.on('close', () => {
                    console.log('Local server has shut down');
                    resolve();
                });

                // Timeout for forced shutdown
                setTimeout(() => {
                    if (!serverProcess.killed) {
                        serverProcess.kill('SIGKILL');
                    }
                    resolve();
                }, 5000);
            });
        }
    });

    for (const example of exampleMetaData) {
        makeTest(example.categoryKebab, example.exampleNameKebab);
    }

    function makeTest(category, exampleName) {
        it(`${category}/${exampleName}`, async function () {
            this.timeout(30000);

            await page.goto(`http://localhost:5555/#/${category}/${exampleName}`, {
                waitUntil: 'networkidle0',
                timeout: 20000
            });

            await page.waitForSelector('#app', { timeout: 10000 });

            await page.waitForFunction(() => {
                const app = document.querySelector('#app');
                return app && app.children.length > 0;
            }, { timeout: 10000 });

            // get canvas element
            const iFrame = await page.$('#exampleIframe');
            // get canvas element from iframe
            const iframe = await iFrame.contentFrame();
            // get screenshot from canvas
            const canvas = await iframe.$('#application-canvas');

            const screenshot = await canvas.screenshot({ type: 'png' });

            // https://github.com/americanexpress/jest-image-snapshot/issues/272#issuecomment-2696064217
            expect(Buffer.from(screenshot)).toMatchImageSnapshot(this, {
                failureThreshold: 0.01,
                failureThresholdType: 'percent',
                runInProcess: true
            });
        });
    }
});
