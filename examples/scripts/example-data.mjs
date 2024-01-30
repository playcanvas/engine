import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as realExamples from "../src/examples/index.mjs";
import { toKebabCase } from '../src/app/helpers/strings.mjs';
/**
 * It would be possible to *not* pregenerate example-data.js, but then we would include all
 * examples only to generate the list in the UI... which would be a waste.
 */

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;

/** @type {Record<string, Record<string, { nameSlug: string, categorySlug: string}>>} */
const exampleData = {};

if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/`);
}
for (const category_ in realExamples) {
    const category = toKebabCase(category_);
    exampleData[category] = {};
    // @ts-ignore
    const examples = realExamples[category_];
    for (const exampleName_ in examples) {
        const release = process.env.NODE_ENV !== 'development';
        if (release && examples[exampleName_].HIDDEN) {
            console.log(`build:example:data> skip hidden example: ${category_}/${exampleName_}`);
            continue;
        }
        const example = toKebabCase(exampleName_).replace('-example', '');
        // turn: turn into simple array...
        exampleData[category][example] = {
            nameSlug: example,
            categorySlug: category
        };
    }
}
// This will be minified by rollup terser plugin, just keep it readable/debuggable here
const out = `export const exampleData = ${JSON.stringify(exampleData, null, 2)};`;
fs.writeFileSync(`${MAIN_DIR}/src/example-data.mjs`, out);
