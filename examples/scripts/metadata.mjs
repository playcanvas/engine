/**
 * This script is used to generate the standalone HTML file for the iframe to view the example.
 */
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as realExamples from "../src/examples/index.mjs";
import { toKebabCase, kebabCaseToPascalCase } from '../src/app/helpers/strings.mjs';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;

/**
 * @type {{
 *      category: string,
 *      categoryKebab: string,
 *      categoryPascal: string,
 *      exampleName: string,
 *      exampleNameKebab: string,
 *      exampleNamePascal: string,
 *      exampleClass: import('./standalone-html.mjs').ExampleClass
 * }[]}
 */
const exampleMetaData = [];
for (const category in realExamples) {
    const categoryKebab = toKebabCase(category);
    const categoryPascal = kebabCaseToPascalCase(categoryKebab);
    // @ts-ignore
    const examples = realExamples[category];
    for (const name in examples) {
        const exampleClass = examples[name];

        const exampleName = name.replace(/Example$/, "");
        const exampleNameKebab = toKebabCase(exampleName);
        const exampleNamePascal = kebabCaseToPascalCase(exampleNameKebab);

        exampleMetaData.push({
            category,
            categoryKebab,
            categoryPascal,
            exampleName,
            exampleNameKebab,
            exampleNamePascal,
            exampleClass
        });
    }
}

export { exampleMetaData };
