import fs from 'fs';
import path from 'path';

import { toKebabCase } from '../src/app/strings.mjs';
import { bold, createdLog, startLog, writeLog, YELLOW } from '../utils/log.mjs';
import { parseConfig } from '../utils/utils.mjs';

const ROOT_PATH = 'src/examples';
const OUTPUT = 'cache/metadata.mjs';

/**
 * @type {{
 *      path: string,
 *      categoryKebab: string,
 *      exampleNameKebab: string,
 *      hidden: boolean
 * }[]}
 */
const exampleMetaData = [];
const hiddenExamples = [];

/**
 * @param {object} obj - The object.
 * @returns {string} - The stringified object
 */
const objStringify = (obj) => {
    return JSON.stringify(obj, null, 4).replace(/"(\w+)":/g, '$1:');
};

/**
 * @param {string} path - The directory path.
 * @returns {string[]} - The file names in the directory.
 */
const getDirFiles = (path) => {
    if (!fs.existsSync(path)) {
        return [];
    }
    const stats = fs.statSync(path);
    if (!stats.isDirectory()) {
        return [];
    }
    return fs.readdirSync(path);
};


const main = () => {
    startLog('metadata', OUTPUT);
    const start = performance.now();
    const categories = getDirFiles(ROOT_PATH);

    categories.forEach((category) => {
        const categoryPath = path.resolve(`${ROOT_PATH}/${category}`);
        const examplesFiles = getDirFiles(categoryPath);
        const categoryKebab = toKebabCase(category);

        examplesFiles.forEach((exampleFile) => {
            if (!/example.mjs$/.test(exampleFile)) {
                return;
            }
            const examplePath = path.resolve(`${categoryPath}/${exampleFile}`);
            const exampleName = exampleFile.split('.').shift() ?? '';
            const exampleNameKebab = toKebabCase(exampleName);

            const config = parseConfig(fs.readFileSync(examplePath, 'utf-8'));
            const hidden = !!config.HIDDEN;
            if (hidden) {
                hiddenExamples.push(`${categoryKebab}/${exampleNameKebab}`);
            }

            exampleMetaData.push({
                path: categoryPath,
                categoryKebab,
                exampleNameKebab,
                hidden
            });
        });
    });

    if (!fs.existsSync('cache')) {
        fs.mkdirSync('cache');
    }

    fs.writeFileSync(OUTPUT, `export const exampleMetaData = ${objStringify(exampleMetaData)};\n`);

    if (hiddenExamples.length) {
        writeLog(process.stderr, YELLOW, `hidden examples (${bold(hiddenExamples.length)})`);
        hiddenExamples.forEach(example => writeLog(process.stderr, YELLOW, `  ${example}`));
    }

    createdLog(OUTPUT, performance.now() - start);
};
main();
