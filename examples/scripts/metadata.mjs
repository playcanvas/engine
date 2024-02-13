import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { toKebabCase, kebabCaseToPascalCase } from '../src/app/strings.mjs';

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
 *      categoryPascal: string,
 *      exampleNameKebab: string,
 *      exampleNamePascal: string,
 *      config: object
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
        const categoryPascal = kebabCaseToPascalCase(categoryKebab);

        await Promise.all(examplesFiles.map(async (exampleFile) => {
            const examplePath = resolve(`${categoryPath}/${exampleFile}`);
            const module = await import(`file://${examplePath}`);
            const ExampleClass = Object.values(module)[0];
            const config = Object.assign({}, ExampleClass);

            const exampleName = exampleFile.split('.').shift() ?? '';
            const exampleNameKebab = toKebabCase(exampleName);
            const exampleNamePascal = kebabCaseToPascalCase(exampleNameKebab);

            exampleMetaData.push({
                path: examplePath,
                categoryKebab,
                categoryPascal,
                exampleNameKebab,
                exampleNamePascal,
                config
            });

        }));
    }));

    if (!fs.existsSync(`${MAIN_DIR}/cache`)) {
        fs.mkdirSync(`${MAIN_DIR}/cache`);
    }

    const lines = [
        `export const exampleMetaData = ${stringify(exampleMetaData)};`,
        ''
    ];
    fs.writeFileSync(`${MAIN_DIR}/cache/metadata.mjs`, lines.join('\n'));

    return 0;
}
main().then(process.exit);
