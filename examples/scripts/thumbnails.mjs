/**
 * This file spawns a pool of puppeteer instances to take screenshots of each example for thumbnail.
 */
/* eslint-disable no-await-in-loop */
import fs from 'fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'node:child_process';

import { exampleMetaData } from '../cache/metadata.mjs';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || '12321';
const MAIN_DIR = `${__dirname}/../`;
const TIMEOUT = 1e8;
const DEBUG = process.argv.includes('--debug');
const CLEAN = process.argv.includes('--clean');

class PuppeteerPool {
    /**
     * Index of browser with the fewest open pages
     *
     * @type {number}
     */
    _minPageIdx = 0;

    /**
     * Internal size of pool size. Defaults to 4.
     *
     * @type {number}
     */
    _size = 4;

    /**
     * @typedef {object} Item
     * @property {import("puppeteer").Browser} browser - Browser instance.
     * @property {number} pages - Number of open pages.
     */
    /**
     * @type {Item[]}
     */
    _pool = [];

    /**
     * @param {number} size - Pool size.
     */
    constructor(size) {
        if (size < 1) {
            throw new Error('size must be >1');
        }
        this._size = size;
    }

    /**
     * @param {import("puppeteer").PuppeteerLaunchOptions} options - Launch options.
     */
    async launch(options = {}) {
        for (let i = 0; i < this._size; i++) {
            this._pool.push({
                browser: await puppeteer.launch(options),
                pages: 0
            });
        }
    }

    /**
     * Allocates the pool items whos browser has the fewest pages open.
     *
     * @returns {Item} - The pool item
     */
    allocPoolItem() {
        for (let i = 0; i < this._pool.length; i++) {
            if (this._pool[i].pages < this._pool[this._minPageIdx].pages) {
                this._minPageIdx = i;
            }
        }
        const item = this._pool[this._minPageIdx];
        return item;
    }

    /**
     * @param {Item} item - The pool item.
     * @returns {Promise<import("puppeteer").Page>} - The created page
     */
    newPage(item) {
        const promise = item.browser.newPage();
        item.pages++;
        return promise;
    }

    /**
     * @param {Item} item - The pool item.
     * @param {import("puppeteer").Page} page - The page to close.
     * @returns {Promise<void>} - The close promise
     */
    closePage(item, page) {
        const promise = page.close();
        item.pages--;
        return promise;
    }

    close() {
        return Promise.all(
            this._pool.map((item) => {
                item.pages = 0;
                return item.browser.close();
            })
        );
    }
}

/**
 * @param {PuppeteerPool} pool - The pool instance.
 * @param {string} categoryKebab - Category kebab name.
 * @param {string} exampleNameKebab - Example kebab name.
 */
async function takeThumbnails(pool, categoryKebab, exampleNameKebab) {
    const poolItem = pool.allocPoolItem();
    const page = await pool.newPage(poolItem);
    if (DEBUG) {
        page.on('console', message => console.log(`[CONSOLE] ${message.type().substring(0, 3).toUpperCase()} ${message.text()}`)
        );
        page.on('pageerror', ({ message }) => console.log(`[PAGE ERROR] ${message}`));
        page.on('requestfailed', request => console.log(`[REQUEST FAILED] ${request.failure()?.errorText} ${request.url()}`)
        );
    }

    // navivate to example
    const link = `http://localhost:${PORT}/iframe/${categoryKebab}_${exampleNameKebab}.html?miniStats=false&deviceType=webgl2`;
    if (DEBUG) {
        console.log('goto', link);
    }
    await page.goto(link, { timeout: TIMEOUT });

    // wait to load
    if (DEBUG) {
        console.log('wait for', link);
    }
    await page.waitForFunction('window?.pc?.app?._time > 1000', { timeout: TIMEOUT });

    // screenshot page
    await page.screenshot({ path: `${MAIN_DIR}/thumbnails/${categoryKebab}_${exampleNameKebab}.webp`, type: 'webp' });

    // read in image as data
    // N.B. Cannot use path because of file locking (https://github.com/lovell/sharp/issues/346)
    const imgData = fs.readFileSync(`${MAIN_DIR}/thumbnails/${categoryKebab}_${exampleNameKebab}.webp`);

    // copy and crop image for large thumbnail
    await sharp(imgData)
        .resize(320, 240)
        .toFile(`${MAIN_DIR}/thumbnails/${categoryKebab}_${exampleNameKebab}_large.webp`);

    // copy and crop image for small thumbnail
    await sharp(imgData)
        .resize(64, 48)
        .toFile(`${MAIN_DIR}/thumbnails/${categoryKebab}_${exampleNameKebab}_small.webp`);

    // remove screenshot
    fs.unlinkSync(`${MAIN_DIR}/thumbnails/${categoryKebab}_${exampleNameKebab}.webp`);

    // close page
    await pool.closePage(poolItem, page);

    console.log(`screenshot taken for: ${categoryKebab}/${exampleNameKebab}`);
}

/**
 * @param {typeof exampleMetaData} metadata - Example metadata.
 */
async function takeScreenshots(metadata) {
    if (metadata.length === 0) {
        return;
    }

    if (CLEAN) {
        fs.rmSync(`${MAIN_DIR}/thumbnails`, { recursive: true, force: true });
    }
    if (!fs.existsSync(`${MAIN_DIR}/thumbnails`)) {
        fs.mkdirSync(`${MAIN_DIR}/thumbnails`);
    }

    // create browser instance with new page
    const pool = new PuppeteerPool(4);
    await pool.launch({ headless: 'new' });

    const screenshotPromises = [];
    for (let i = 0; i < metadata.length; i++) {
        const { categoryKebab, exampleNameKebab } = metadata[i];

        // check if thumbnail exists
        if (fs.existsSync(`${MAIN_DIR}/thumbnails/${categoryKebab}_${exampleNameKebab}_large.webp`)) {
            console.log(`skipped: ${categoryKebab}/${exampleNameKebab}`);
            continue;
        }

        screenshotPromises.push(
            takeThumbnails(pool, categoryKebab, exampleNameKebab)
        );
    }

    // ensure all screenshots have finished.
    await Promise.all(screenshotPromises);

    // close pool
    await pool.close();
}

/**
 * @param {number} ms - Milliseconds.
 * @returns {Promise<void>} - Sleep promise.
 */
function sleep(ms = 0) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function main() {
    console.log('Spawn server on', PORT);
    // We need this kind of command:
    // npx serve dist --config ../serve.json
    // Reason: https://github.com/vercel/serve/issues/732
    // (who *ever* thought that stripping .html was a good idea in the first place...)
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'npx.cmd' : 'npx';
    const server = spawn(cmd, ['serve', 'dist', '-l', PORT, '--no-request-logging', '--config', '../serve.json']);
    await sleep(1000); // give a second to spawn server
    console.log('Starting puppeteer screenshot process');
    try {
        console.time('Time');
        await takeScreenshots(exampleMetaData);
        console.timeEnd('Time');
    } catch (e) {
        console.error(e);
    }
    if (isWin) {
        execSync(`taskkill /f /pid ${server.pid}`);
    } else {
        server.kill();
    }
    console.log('Killed server on', PORT);
    return 0;
}
main().then(process.exit);
