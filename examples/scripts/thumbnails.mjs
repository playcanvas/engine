import fs from 'fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import getExamplesList from '../src/app/helpers/read-dir.mjs';
import { kebabCaseToPascalCase, toKebabCase } from '../src/app/helpers/strings.mjs';
import * as categories from "../src/examples/index.mjs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MAIN_DIR = `${__dirname}/../`;
const debug = true;
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
        // TODO use use index.mjs...
        if (example.includes('.shared') || example === 'LitMaterial') {
            continue;
        }
        if (fs.existsSync(`${MAIN_DIR}/dist/thumbnails/${categorySlug}_${exampleSlug}_large.png`)) {
            console.log(`skipped: ${category}/${example}`);
            continue;
        }
        const port = process.env.PORT || 5000;
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        if (debug) {
            page.on('console', message => console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`));
            page.on('pageerror', ({ message }) => console.log(message));
            // page.on('response', response => console.log(`${response.status()} ${response.url()}`));
            page.on('requestfailed', request => console.log(`${request.failure().errorText} ${request.url()}`));
        }
        //const link = `http://localhost:${port}/iframe/?category=${category}&example=${example}&miniStats=false`;
        const link = `http://localhost/playcanvas-engine/examples/src/iframe/?category=${category}&example=${example}&miniStats=false`;
        if (debug) {
            console.log("goto", link);
        }
        await page.goto(link);
        if (debug) {
            console.log("wait for", link);
        }
        await page.waitForFunction("pc.app?._time > 1000");
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

takeScreenshots();
