import fs from 'fs';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
/* eslint-disable no-await-in-loop */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAIN_DIR = `${__dirname}/../`;
const exampleList = [];

let categories = fs.readdirSync(`${MAIN_DIR}/src/examples/`);
categories = categories.filter(c => c !== 'index.mjs');
categories.forEach(function (category) {
    let examples = fs.readdirSync(`${MAIN_DIR}/src/examples/${category}`);
    examples = examples.filter(e => e !== 'index.mjs');
    examples.forEach((e) => {
        exampleList.push({
            category,
            example: e.replace('.tsx', '')
        });
    });
});

async function takeScreenshots() {
    for (let i = 0; i < exampleList.length; i++) {
        const example = exampleList[i].example;
        const category = exampleList[i].category;
        if (fs.existsSync(`${MAIN_DIR}/dist/thumbnails/${category}_${example}_large.png`)) {
            console.log(`skipped: ${category}/${example}`);
            continue;
        }
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(`http://localhost:5000/iframe/${category}/${example}?miniStats=false`);

        const promise = new Promise((resolve) => {
            setTimeout(async () => {

                if (!fs.existsSync(`${MAIN_DIR}/dist/thumbnails`)) {
                    fs.mkdirSync(`${MAIN_DIR}/dist/thumbnails`);
                }
                if (!fs.existsSync(`${MAIN_DIR}/dist/temp`)) {
                    fs.mkdirSync(`${MAIN_DIR}/dist/temp`);
                }

                await page.screenshot({ path: `${MAIN_DIR}/dist/temp/${category}_${example}.png` });
                await sharp(`${MAIN_DIR}/dist/temp/${category}_${example}.png`)
                    .resize(320, 240)
                    .toFile(`${MAIN_DIR}/dist/thumbnails/${category}_${example}_large.png`);
                await sharp(`${MAIN_DIR}/dist/temp/${category}_${example}.png`)
                    .resize(64, 48)
                    .toFile(`${MAIN_DIR}/dist/thumbnails/${category}_${example}_small.png`);
                console.log(`screenshot taken for: ${category}/${example}`);
                await browser.close();
                resolve();
                fs.rmdirSync(`${MAIN_DIR}/dist/temp`, { recursive: true });
            }, 5000);
        });
        await promise;
    }
}

takeScreenshots();
