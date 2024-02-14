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
 *      examplePath: string,
 *      controlsPath: string,
 *      categoryKebab: string,
 *      categoryPascal: string,
 *      exampleNameKebab: string,
 *      exampleNamePascal: string
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

function main() {
    const rootPath = `${MAIN_DIR}/src/examples`;
    const categories = getDirFiles(rootPath);

    categories.forEach((category) => {
        const categoryPath = resolve(`${rootPath}/${category}`);
        const examplesFiles = getDirFiles(categoryPath);

        const categoryKebab = toKebabCase(category);
        const categoryPascal = kebabCaseToPascalCase(categoryKebab);

        examplesFiles.forEach((exampleFile) => {
            const folderPath = resolve(`${categoryPath}/${exampleFile}`);
            const examplePath = resolve(folderPath, 'example.mjs');
            const controlsPath = resolve(folderPath, 'controls.mjs');

            const exampleName = exampleFile.split('.').shift() ?? '';
            const exampleNameKebab = toKebabCase(exampleName);
            const exampleNamePascal = kebabCaseToPascalCase(exampleNameKebab);

//             let contents = fs.readFileSync(examplePath, 'utf-8');
//             const regex = /(\s*import[\s\w*{}]+["']\w+["']\s*;?[\s\r\n]*)/g;
//             let imports;
//             const top = [];
//             while (imports = regex.exec(contents)) {
//                 top.push(imports[1].trim());
//             }

//             const header = `/**
//  * @returns {Promise<pc.AppBase>} The example application.
//  */`;

//             contents = contents.replace(/(\s*import[\s\w*{}]+["']\w+["']\s*;?[\s\r\n]*)/g, '');
//             fs.writeFileSync(exampleFile)


            // exampleMetaData.push({
            //     examplePath,
            //     controlsPath,
            //     categoryKebab,
            //     categoryPascal,
            //     exampleNameKebab,
            //     exampleNamePascal
            // });
        });
    });

    // if (!fs.existsSync(`${MAIN_DIR}/cache`)) {
    //     fs.mkdirSync(`${MAIN_DIR}/cache`);
    // }

    // fs.writeFileSync(`${MAIN_DIR}/cache/metadata.mjs`, `export const exampleMetaData = ${stringify(exampleMetaData)};\n`);
}
main();
