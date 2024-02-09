import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import * as realExamples from "../src/examples/index.mjs";
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
 * }[]}
 */
const exampleMetaData = [];
/**
 * @type {Record<string, { examples: Record<string, string> }>}
 */
const categories = {};

/**
 * @param {string} path - The source path.
 * @param {string[]} exclude - The list of file names to ignore.
 * @returns {string[]} - A list of scanned paths.
 */
function scanFiles(path, exclude = []) {
    /**
     * @type {string[]}
     */
    const files = [];
    if (!fs.existsSync(path)) {
        return files;
    }
    const name = path.split('/').pop() ?? '';
    const stats = fs.statSync(path);
    if (stats.isDirectory()) {
        const children = fs.readdirSync(path);
        for (let i = 0; i < children.length; i++) {
            files.push(...scanFiles(`${path}/${children[i]}`, exclude));
        }
    }
    if (stats.isFile() && exclude.indexOf(name) === -1) {
        files.push(resolve(path));
    }
    return files;

}

async function main() {
    const classPathMap = new Map();
    const files = scanFiles(`${MAIN_DIR}/src/examples`, ['index.mjs']);
    const exampleImports = await Promise.all(files.map(path => import(path)));
    for (let i = 0; i < exampleImports.length; i++) {
        const exampleClass = Object.values(exampleImports[i])[0];
        classPathMap.set(exampleClass.name, files[i]);
    }

    for (const category in realExamples) {
        const categoryKebab = toKebabCase(category);
        const categoryPascal = kebabCaseToPascalCase(categoryKebab);

        categories[categoryKebab] = { examples: {} };

        // @ts-ignore
        const examples = realExamples[category];
        for (const name in examples) {
            const exampleName = name.replace(/Example$/, "");
            const exampleNameKebab = toKebabCase(exampleName);
            const exampleNamePascal = kebabCaseToPascalCase(exampleNameKebab);

            categories[categoryKebab].examples[exampleNameKebab] = exampleNamePascal;

            exampleMetaData.push({
                path: classPathMap.get(examples[name].name),
                categoryKebab,
                categoryPascal,
                exampleNameKebab,
                exampleNamePascal
            });
        }
    }

    if (!fs.existsSync(`${MAIN_DIR}/cache`)) {
        fs.mkdirSync(`${MAIN_DIR}/cache`);
    }

    const lines = [
        `export const exampleMetaData = ${stringify(exampleMetaData)};`,
        `export const categories = ${stringify(categories)};`,
        ''
    ];
    fs.writeFileSync(`${MAIN_DIR}/cache/metadata.mjs`, lines.join('\n'));
}
main();
