const fs = require('fs');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const MAIN_DIR = `${__dirname}/../`;
const exampleList = [];

let categories = fs.readdirSync(`${MAIN_DIR}/src/examples/`);
categories = categories.filter(c => c !== 'index.js');
categories.forEach(function (category) {
    let examples = fs.readdirSync(`${MAIN_DIR}/src/examples/${category}`);
    examples = examples.filter(e => e !== 'index.js');
    examples.forEach((e) => {
        exampleList.push({
            category,
            example: e.replace('.tsx', '')
        });
    });
});

exampleList.forEach(async ({ example, category }) => {
    if (fs.existsSync(`${MAIN_DIR}/dist/thumbnails/${category}_${example}_large.png`)) {
        console.log('skipped: ', `http://localhost:5000/iframe/${category}/${example}`);
        return;
    }
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(`http://localhost:5000/iframe/${category}/${example}`);

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
            console.log('screenshot taken for: ', `http://localhost:5000/#/iframe/${category}/${example}?fullscreen=true`);
            await browser.close();
            resolve();
        }, 5000);
    });
    await promise;
});
fs.rmdirSync(`${MAIN_DIR}/dist/temp`, { recursive: true });
