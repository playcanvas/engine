import fs from 'fs';
import readDirectoryNames from '../src/app/helpers/read-dir-names.mjs';
import getExamplesList from '../src/app/helpers/read-dir.mjs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
/**
 * It would be possible to *not* pregenerate example-data.js, but then we would include all
 * examples only to generate the list in the UI... which would be a waste.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MAIN_DIR = `${__dirname}/../`;
const exampleData = {};
if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/`);
}
globalThis.location = {href: "unused"};
const categories = readDirectoryNames(`${MAIN_DIR}/src/examples/`);
for (const category of categories) {
    exampleData[category] = {};
    const examples = getExamplesList(MAIN_DIR, category);
    for (const exampleName of examples) {        
        const example = exampleName.replace('.mjs', '');
        exampleData[category][example] = {};
        const path = `${MAIN_DIR}src/examples/${category}/${exampleName}`;
        const mod = await import(path);
        const keyForExample = Object.keys(mod).find(key => key.endsWith('Example'));
        if (!keyForExample) {
            console.warn("skip", path);
            continue;
        }
        const exampleClass = mod[keyForExample];
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
