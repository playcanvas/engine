/**
 * This script is used to generate template HTML files to create embeds while sharing.
 */
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { exampleMetaData } from '../cache/metadata.mjs';

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
          <meta name="twitter:image" content="https://playcanvas.github.io/thumbnails/${largeThumbnailName}.webp" />
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

function main() {
    if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/`);
    }
    if (!fs.existsSync(`${MAIN_DIR}/dist/share/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/share/`);
    }

    for (let i = 0; i < exampleMetaData.length; i++) {
        const { categoryKebab, exampleNameKebab } = exampleMetaData[i];
        const content = template({
            path: `${categoryKebab}/${exampleNameKebab}`,
            exampleTitle: `${exampleNameKebab.split('-').join(' ')}`,
            largeThumbnailName: `${categoryKebab}_${exampleNameKebab}_large`
        });
        const dirPath = `${MAIN_DIR}/dist/share/${categoryKebab}_${exampleNameKebab}`;
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        }
        fs.writeFileSync(`${dirPath}/index.html`, content);
    }
}
main();
