import fs from 'fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import getExamplesList from '../src/app/helpers/read-dir.mjs';
/* eslint-disable no-await-in-loop */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAIN_DIR = `${__dirname}/../`;
const exampleList = [];

function isDir(path) {
    try {
        var stat = fs.lstatSync(path);
        return stat.isDirectory();
    } catch (e) {
        // lstatSync throws an error if path doesn't exist
        return false;
    }
}
//globalThis.location = {
//    href: 'unused'
//};
//import * as realExamples from "../src/examples/index.mjs";

let categories = fs.readdirSync(`${MAIN_DIR}/src/examples/`);
categories = categories.filter(c => isDir(`${MAIN_DIR}/src/examples/${c}`));
console.log("categories", categories);
//console.log("realExamples", {...realExamples});

categories.forEach(function (category) {
    let examples = getExamplesList(MAIN_DIR, category);
    examples = examples.filter(e => e !== 'index.mjs');
    examples.forEach((e) => {
        exampleList.push({
            category,
            example: e.replace('.mjs', '')
        });
    });
});


if (!fs.existsSync(`${MAIN_DIR}/dist/thumbnails`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/thumbnails`);
}

function kebabCaseToPascalCase(str) {
    return str.split('-')
        .map(s => s.charAt(0).toUpperCase() + s.substring(1))
        .join('')
        .replace('1d', '1D')
        .replace('2d', '2D')
        .replace('3d', '3D');
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
        page.on('console', message => console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`));
        page.on('pageerror', ({ message }) => console.log(message));
        // page.on('response', response => console.log(`${response.status()} ${response.url()}`));
        page.on('requestfailed', request => console.log(`${request.failure().errorText} ${request.url()}`));
        const link = `http://localhost:${port}/iframe/?category=${category}&example=${example}&miniStats=false`;
        //const link = `http://localhost/playcanvas-engine/examples/src/iframe/?category=${category}&example=${example}&miniStats=false`;
        console.log("goto", link);
        await page.goto(link);
        console.log("wait for", link);
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
