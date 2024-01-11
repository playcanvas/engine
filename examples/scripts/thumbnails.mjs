import fs from 'fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { kebabCaseToPascalCase, toKebabCase } from '../src/app/helpers/strings.mjs';
import * as categories from "../src/examples/index.mjs";
import { spawn } from 'node:child_process';
const port = process.env.PORT || '12321';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MAIN_DIR = `${__dirname}/../`;
const debug = false;
/** @type {{category: string, example: string}[]} */
const exampleList = [];
for (const category_ in categories) {
    const category = toKebabCase(category_);
    const examples = categories[category_];
    for (const example_ in examples) {
        const example = toKebabCase(example_).replace('-example', '');
        exampleList.push({
            category,
            example,
        });
    }
}
if (!fs.existsSync(`${MAIN_DIR}/dist/thumbnails`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/thumbnails`);
}
async function takeScreenshots() {
    for (let i = 0; i < exampleList.length; i++) {
        const exampleListItem = exampleList[i];
        const exampleSlug = exampleListItem.example;
        const categorySlug = exampleListItem.category;
        const example = kebabCaseToPascalCase(exampleListItem.example);
        const category = kebabCaseToPascalCase(exampleListItem.category);
        if (fs.existsSync(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}_large.png`)) {
            console.log(`skipped: ${category}/${example}`);
            continue;
        }
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        if (debug) {
            page.on('console', message => console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`));
            page.on('pageerror', ({ message }) => console.log(message));
            // page.on('response', response => console.log(`${response.status()} ${response.url()}`));
            page.on('requestfailed', request => console.log(`${request.failure().errorText} ${request.url()}`));
        }
        // const link = `http://localhost/playcanvas-engine/examples/dist/iframe/${category}_${example}.html?miniStats=false`;
        const link = `http://localhost:${port}/iframe/${category}_${example}.html?miniStats=false`;
        if (debug) {
            console.log("goto", link);
        }
        await page.goto(link);
        if (debug) {
            console.log("wait for", link);
        }
        await page.waitForFunction("window?.pc?.app?._time > 1000");
        await page.screenshot({ path: `${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}.png` });
        await sharp(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}.png`)
            .resize(320, 240)
            .toFile(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}_large.png`);
        await sharp(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}.png`)
            .resize(64, 48)
            .toFile(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}_small.png`);
        fs.rmSync(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}.png`);
        console.log(`screenshot taken for: ${category}/${example}`);
        await browser.close();
    }
}
async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
async function main() {
    console.log('Spawn server on', port);
    // We need this kind of command:
    // npx serve dist --config ../serve.json
    // Reason: https://github.com/vercel/serve/issues/732
    // (who *ever* thought that stripping .html was a good idea in the first place...)
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const server = spawn(cmd, ['serve', 'dist', '-l', port, '--no-request-logging', '--config', '../serve.json']);
    await sleep(1000); // give a second to spawn server
    console.log("Starting puppeteer screenshot process");
    try {
        await takeScreenshots();
    } catch (e) {
        console.error(e);
    }
    console.log('Kill server on', port);
    server.kill();
}
main();
