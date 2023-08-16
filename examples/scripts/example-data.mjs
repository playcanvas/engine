import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as realExamples from "../src/examples/index.mjs";
import { toKebabCase } from '../src/app/helpers/strings.mjs';
/**
 * It would be possible to *not* pregenerate example-data.js, but then we would include all
 * examples only to generate the list in the UI... which would be a waste.
 */
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;
const exampleData = {};
if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/`);
}
for (const category_ in realExamples) {
    const category = toKebabCase(category_);
    exampleData[category] = {};
    const examples = realExamples[category_];
    for (const exampleName_ in examples) {        
        const exampleClass = examples[exampleName_];
        const example = toKebabCase(exampleName_).replace('-example', '');
        exampleData[category][example] = {};
        const exampleFunc = exampleClass.example.toString();
        exampleData[category][example].example = exampleFunc;
        exampleData[category][example].nameSlug = example;
        exampleData[category][example].categorySlug = category;
        if (exampleClass.FILES) {
            exampleData[category][example].files = exampleClass.FILES;
        }
        if (exampleClass.controls) {
            exampleData[category][example].controls = exampleClass.controls.toString();
        }
    }
}
// This will be minified by rollup terser plugin, just keep it readable/debuggable here
const out = `export const exampleData = ${JSON.stringify(exampleData, null, 2)};`;
fs.writeFileSync(`${MAIN_DIR}/src/example-data.mjs`, out);
