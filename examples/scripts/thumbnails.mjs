/* eslint-disable no-await-in-loop */
import fs from 'fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { kebabCaseToPascalCase, toKebabCase } from '../src/app/helpers/strings.mjs';
import * as categories from "../src/examples/index.mjs";
import { spawn, execSync } from 'node:child_process';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || '12321';
const MAIN_DIR = `${__dirname}/../`;
const TIMEOUT = 1e8;
const DEBUG = false;

/** @type {{category: string, example: string}[]} */
const exampleList = [];
for (const category_ in categories) {
    const category = toKebabCase(category_);
    // @ts-ignore
    const examples = categories[category_];
    for (const example_ in examples) {
        const example = toKebabCase(example_).replace('-example', '');
        exampleList.push({
            category,
            example
        });
    }
}
if (!fs.existsSync(`${MAIN_DIR}/dist/thumbnails`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/thumbnails`);
}

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
        return Promise.all(this._pool.map((item) => {
            item.pages = 0;
            return item.browser.close();
        }));
    }
}

/**
 * @param {PuppeteerPool} pool - The pool instance.
 * @param {string} exampleSlug - Example slug.
 * @param {string} categorySlug - Category slug.
 * @param {string} example - Example kebab name.
 * @param {string} category - Category kebab name.
 */
async function takeThumbnails(pool, exampleSlug, categorySlug, example, category) {
    const poolItem = pool.allocPoolItem();
    const page = await pool.newPage(poolItem);
    if (DEBUG) {
        page.on('console', message => console.log(`${message.type().substring(0, 3).toUpperCase()} ${message.text()}`));
        page.on('pageerror', ({ message }) => console.log(message));
        page.on('requestfailed', request => console.log(`${request.failure()?.errorText} ${request.url()}`));
    }

    // navivate to example
    const link = `http://localhost:${PORT}/iframe/${category}_${example}.html?miniStats=false`;
    if (DEBUG) {
        console.log("goto", link);
    }
    await page.goto(link, { timeout: TIMEOUT });

    // wait to load
    if (DEBUG) {
        console.log("wait for", link);
    }
    await page.waitForFunction("window?.pc?.app?._time > 1000", { timeout: TIMEOUT });

    // screenshot page
    await page.screenshot({ path: `${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}.png` });

    // copy and crop image for large thumbnail
    await sharp(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}.png`)
        .resize(320, 240)
        .toFile(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}_large.png`);

    // copy and crop image for small thumbnail
    await sharp(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}.png`)
        .resize(64, 48)
        .toFile(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}_small.png`);

    // remove screenshot
    fs.rmSync(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}.png`);

    // close page
    await pool.closePage(poolItem, page);

    console.log(`screenshot taken for: ${category}/${example}`);
}

async function takeScreenshots() {
    if (exampleList.length === 0) {
        return;
    }

    // create browser instance with new page
    const pool = new PuppeteerPool(4);
    await pool.launch({ headless: 'new' });

    const screenshotPromises = [];
    for (let i = 0; i < exampleList.length; i++) {
        const exampleListItem = exampleList[i];
        const exampleSlug = exampleListItem.example;
        const categorySlug = exampleListItem.category;
        const example = kebabCaseToPascalCase(exampleListItem.example);
        const category = kebabCaseToPascalCase(exampleListItem.category);

        // check if thumbnail exists
        if (fs.existsSync(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}_large.png`)) {
            console.log(`skipped: ${category}/${example}`);
            continue;
        }

        screenshotPromises.push(takeThumbnails(pool, exampleSlug, categorySlug, example, category));

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
    console.log("Starting puppeteer screenshot process");
    try {
        console.time('Time');
        await takeScreenshots();
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
