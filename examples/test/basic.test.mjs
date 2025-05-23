import expect from 'expect';
import { toMatchImageSnapshot } from 'expect-mocha-image-snapshot';
import puppeteer from 'puppeteer';

expect.extend({ toMatchImageSnapshot });

describe('Serve-based static server tests', function () {
    let browser;
    let page;

    before(async function () {
        this.timeout(10000);
        browser = await puppeteer.launch({ headless: false, devtools: false, defaultViewport: { width: 1920, height: 1080 } });
        page = await browser.newPage();

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    });

    after(async function () {
        await page.close();
        await browser.close();
    });

    it('hello-world', async function () {
        this.timeout(30000);

        await page.goto('http://localhost:5555', {
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
        console.log(screenshot);

        // https://github.com/americanexpress/jest-image-snapshot/issues/272#issuecomment-2696064217
        expect(Buffer.from(screenshot)).toMatchImageSnapshot(this, {
            // customSnapshotsDir: '__image_snapshots__',
            // customDiffDir: '__image_diff_output__',
            failureThreshold: 0.01,
            failureThresholdType: 'percent',
            runInProcess: true
        });
    });
});
