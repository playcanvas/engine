import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { toKebabCase } from '../src/app/strings.mjs';
import { objStringify, getDirFiles, parseConfig } from './utils.mjs';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;

/**
 * @type {{
 *      path: string,
 *      categoryKebab: string,
 *      exampleNameKebab: string
 * }[]}
 */
const exampleMetaData = [];

function main() {
    const rootPath = `${MAIN_DIR}/src/examples`;
    const categories = getDirFiles(rootPath);

    categories.forEach((category) => {
        const categoryPath = resolve(`${rootPath}/${category}`);
        const examplesFiles = getDirFiles(categoryPath);
        const categoryKebab = toKebabCase(category);

        examplesFiles.forEach((exampleFile) => {
            if (!/\example.mjs$/.test(exampleFile)) {
                return;
            }
            const examplePath = resolve(`${categoryPath}/${exampleFile}`);
            const exampleName = exampleFile.split('.').shift() ?? '';
            const exampleNameKebab = toKebabCase(exampleName);

            const config = parseConfig(fs.readFileSync(examplePath, 'utf-8'));
            if (config.HIDDEN && process.env.NODE_ENV !== 'development') {
                console.info(`skipping hidden ${categoryKebab}/${exampleNameKebab}`);
                return;
            }

            exampleMetaData.push({
                path: categoryPath,
                categoryKebab,
                exampleNameKebab
            });
        });
    });

    if (!fs.existsSync(`${MAIN_DIR}/cache`)) {
        fs.mkdirSync(`${MAIN_DIR}/cache`);
    }

    fs.writeFileSync(`${MAIN_DIR}/cache/metadata.mjs`, `export const exampleMetaData = ${objStringify(exampleMetaData)};\n`);
}
main();
