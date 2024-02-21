import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { toKebabCase } from '../src/app/strings.mjs';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;

/**
 * @param {object} obj - The object.
 * @returns {string} - The stringifiied object
 */
function stringify(obj) {
    return JSON.stringify(obj, null, 4).replace(/"(\w+)":/g, '$1:');
}

/**
 * @type {{
 *      path: string,
 *      categoryKebab: string,
 *      exampleNameKebab: string
 * }[]}
 */
const exampleMetaData = [];

/**
 * @param {string} path - The directory path.
 * @returns {string[]} - The file names in the directory.
 */
function getDirFiles(path) {
    if (!fs.existsSync(path)) {
        return [];
    }
    const stats = fs.statSync(path);
    if (!stats.isDirectory()) {
        return [];
    }
    return fs.readdirSync(path);
}

async function main() {
    const rootPath = `${MAIN_DIR}/src/examples`;
    const categories = getDirFiles(rootPath);

    await Promise.all(categories.map(async (category) => {
        const categoryPath = resolve(`${rootPath}/${category}`);
        const examplesFiles = getDirFiles(categoryPath);

        const categoryKebab = toKebabCase(category);

        await Promise.all(examplesFiles.map(async (exampleFile) => {
            const path = resolve(`${categoryPath}/${exampleFile}`);
            const exampleName = exampleFile.split('.').shift() ?? '';
            const exampleNameKebab = toKebabCase(exampleName);

            const configPath = resolve(path, 'config.mjs');
            if (fs.existsSync(configPath)) {
                const config = (await import(`file://${configPath}`)).default;
                if (config.HIDDEN && process.env.NODE_ENV !== 'development') {
                    console.info(`skipping hidden ${categoryKebab}/${exampleNameKebab}`);
                    return;
                }
            }

            exampleMetaData.push({
                path,
                categoryKebab,
                exampleNameKebab
            });
        }));
    }));

    if (!fs.existsSync(`${MAIN_DIR}/cache`)) {
        fs.mkdirSync(`${MAIN_DIR}/cache`);
    }

    fs.writeFileSync(`${MAIN_DIR}/cache/metadata.mjs`, `export const exampleMetaData = ${stringify(exampleMetaData)};\n`);

    return 0;
}
main().then(process.exit);
