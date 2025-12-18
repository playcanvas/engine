import fs from 'fs';
import path from 'path';

import { toKebabCase } from '../src/app/strings.mjs';
import { parseConfig } from '../utils/utils.mjs';

/**
 * Sanitizes a file or directory name to prevent path traversal attacks
 * @param {string} name - The file or directory name to sanitize
 * @returns {string} - The sanitized name
 */
const sanitizeName = (name) => {
    // Remove any path traversal sequences and null bytes
    return name.replace(/\.\./g, '').replace(/\0/g, '').replace(/[/\\]/g, '');
};

/**
 * @type {{
 *      path: string,
 *      categoryKebab: string,
 *      exampleNameKebab: string
 * }[]}
 */
const exampleMetaData = [];

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
    const rootPath = 'src/examples';
    const categories = getDirFiles(rootPath);

    categories.forEach((category) => {
        const sanitizedCategory = sanitizeName(category);
        const categoryPath = path.resolve(rootPath, sanitizedCategory);
        const examplesFiles = getDirFiles(categoryPath);
        const categoryKebab = toKebabCase(category);

        examplesFiles.forEach((exampleFile) => {
            if (!/example.mjs$/.test(exampleFile)) {
                return;
            }
            const sanitizedExampleFile = sanitizeName(exampleFile);
            const examplePath = path.resolve(categoryPath, sanitizedExampleFile);
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

    if (!fs.existsSync('cache')) {
        fs.mkdirSync('cache');
    }

    fs.writeFileSync('cache/metadata.mjs', `export const exampleMetaData = ${objStringify(exampleMetaData)};\n`);
};
main();
