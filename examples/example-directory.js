const fs = require('fs');

let categoriesList = [];
let categoriesString = '';
let categoriesCounter = 0;
let examplesCounter = 0;
fs.readdir(`${__dirname}/src/examples/`, function (err, categories) {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }
    categoriesCounter = categories.length;
    categories.forEach(function (category) {
        var dir = `dist/${category}`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        fs.readdir(`${__dirname}/src/examples/${category}`, (err, examples) => {
            examples = examples.map((example) => example.replace('.tsx', ''));
            categoriesList.push({
                name: category,
                examples
            });
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }
            categoriesString += `<h2>${category}</h2>`;
            examplesCounter += examples.length;
            examples.forEach((example) => {
                categoriesString += `<li><a href='/#/DIRECTORY_TYPE/${category}/${example}'>${example}</a></li>`;
                examplesCounter--;
                if (examplesCounter === 0) {
                    categoriesCounter--;
                    if (categoriesCounter === 0) {
                        createDirectory('iframe');
                        createDirectory('debug');
                        createCategoriesListFile();
                    }
                }
                const content = `
<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="refresh" content="0; url='/#/${category}/${example}'" />
    <meta name="twitter:card" content="photo" />
    <meta name="twitter:site" content="@playcanvas" />
    <meta name="twitter:title" content="${example.split('-').join(' ')}" />
    <meta name="twitter:description" content="A PlayCanvas engine example" />
    <meta name="twitter:image" content="https://playcanvas.github.io/thumbnails/${category}_${example}.png" />
    <meta name="twitter:url" content="https://playcanvas.github.io/${category}/${example}" />
  </head>
  <body>
    <p>Please follow <a href="/#/${category}/${example}">this link</a>.</p>
  </body>
</html>
`;
                var dir = `dist/${category}/${example}`;
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }
                fs.writeFile(`dist/${category}/${example}/index.html`, content, (err) => {
                    if (err) {
                        console.error(err);
                        return null;
                    }
                });
            });
        });
    });
});

function createDirectory(path) {
    const directoryHtml = (path) => `
    <!DOCTYPE html>
    <html>
    <head>
    </head>
    <body>
    ${categoriesString.split('DIRECTORY_TYPE').join(path)}
    </body>
    </html>
    `;
    var dir = `dist/${path}-directory/`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    fs.writeFile(`dist/${path}-directory/index.html`, directoryHtml(path), (err) => {
        if (err) {
            console.error(err);
            return null;
        }
    });
}

function createCategoriesListFile() {
    const text = `/* eslint-disable no-unused-vars */
var categories = ${JSON.stringify(categoriesList)};`;
    fs.writeFile(`dist/examples.js`, text, (err) => {
        if (err) {
            console.error(err);
            return null;
        }
    });
}
