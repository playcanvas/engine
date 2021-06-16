const fs = require('fs');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const pathData = [];

let categoriesCounter = 0;
let examplesCounter = 0;
fs.readdir(`${__dirname}/src/examples/`, function (err, categories) {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }
    categoriesCounter = categories.length;
    categories.forEach(function (category) {
        fs.readdir(`${__dirname}/src/examples/${category}`, (err, examples) => {
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }
            examplesCounter += examples.length;
            examples.forEach((e) => {
                pathData.push({
                    category,
                    example: e.replace('.tsx', '')
                });
                examplesCounter--;
                if (examplesCounter === 0) {
                    categoriesCounter--;
                    if (categoriesCounter === 0) {
                        takeScreenshots();
                    }
                }
            });
        });
    });
});

async function takeScreenshots() {
    for (let i = 0; i < pathData.length; i++) {
        const { example, category } = pathData[i];

        if (fs.existsSync(`dist/thumbnails/${category}_${example}.png`)) {
            console.log('skipped: ', `http://localhost:5000/#/iframe/${category}/${example}?fullscreen=true`)
            continue;
        }
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(`http://localhost:5000/#/iframe/${category}/${example}?fullscreen=true`);

        const promise = new Promise((resolve, reject) => {
            setTimeout(async () => {

                if (!fs.existsSync(`dist/thumbnails`)) {
                    fs.mkdirSync(`dist/thumbnails`);
                }
                if (!fs.existsSync(`dist/temp`)) {
                    fs.mkdirSync(`dist/temp`);
                }

                await page.screenshot({ path: `dist/temp/${category}_${example}.png` });
                await sharp(`dist/temp/${category}_${example}.png`)
                    .resize(320, 240)
                    .toFile(`dist/thumbnails/${category}_${example}.png`);
                console.log('screenshot taken for: ', `http://localhost:5000/#/iframe/${category}/${example}?fullscreen=true`);
                await browser.close();
                resolve();
            }, 5000);
        });
        await promise;
    }
    fs.rmdirSync('dist/temp', { recursive: true });
}
