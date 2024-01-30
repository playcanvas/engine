import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as realExamples from '../src/examples/index.mjs';
import { toKebabCase } from '../src/app/helpers/strings.mjs';

/**
 * @param {object} options - The options.
 * @param {string} options.path - The path.
 * @param {string} options.exampleTitle - The example title.
 * @param {string} options.largeThumbnailName - The large thumbnail name.
 * @returns {string} - The template string.
 */
function template({ path, exampleTitle, largeThumbnailName }) {
    return `<!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0; url='/#/${path}'" />
          <meta name="twitter:card" content="photo" />
          <meta name="twitter:site" content="@playcanvas" />
          <meta name="twitter:title" content="${exampleTitle}" />
          <meta name="twitter:description" content="A PlayCanvas engine example" />
          <meta name="twitter:image" content="https://playcanvas.github.io/thumbnails/${largeThumbnailName}.png" />
          <meta name="twitter:url" content="https://playcanvas.github.io/${path}" />
        </head>
        <body>
          <p>Please follow <a href="/#/${path}">this link</a>.</p>
        </body>
      </html>`;
}

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MAIN_DIR = `${__dirname}/../`;
const categoriesList = [];
for (const category_ in realExamples) {
    const category = toKebabCase(category_);
    const dir = `${MAIN_DIR}dist/${category}`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    // @ts-ignore
    const examples = realExamples[category_];
    categoriesList.push({
        name: category,
        examples
    });
    for (const exampleName_ in examples) {
        const example = toKebabCase(exampleName_).replace('-example', '');
        const content = template({
            path: `${category}/${example}`,
            exampleTitle: `${example.split('-').join(' ')}`,
            largeThumbnailName: `${category}_${example}_large`
        });
        const dir = `${MAIN_DIR}/dist/${category}/${example}`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        fs.writeFileSync(`${MAIN_DIR}/dist/${category}/${example}/index.html`, content);
    }
}
fs.writeFileSync(`dist/examples.json`, JSON.stringify(categoriesList));
