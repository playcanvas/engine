const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function ensureDirectoryExistence(filePath) {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}


fs.readdir(`${__dirname}/src/examples/`, function (err, categories) {
    // handling error
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }
    // listing all files using forEach
    categories.forEach(function (category) {
        // Do whatever you want to do with the file
        fs.readdir(`${__dirname}/src/examples/${category}`, function (err, examples) {
            // handling error
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }
            // listing all files using forEach
            examples.forEach(function (example) {
                example = example.replace('.tsx', '');
                ensureDirectoryExistence(`dist/thumbnails/${category}/${example}.png`);
                // Do whatever you want to do with the file
                (async () => {
                    const browser = await puppeteer.launch();
                    const page = await browser.newPage();
                    await page.goto(`http://localhost:5000/#/${category}/${example}?fullscreen=true`);
                    setTimeout(async () => {
                        await page.screenshot({ path: `dist/thumbnails/${category}/${example}.png` });
                        await browser.close();
                    }, 500);
                })();
            });
        });
    });
});
