import fs from 'fs';
import BabelParser from '@babel/parser';
import Prettier from 'prettier/standalone';
import Babel from '@babel/standalone';
import formatters from '../src/app/helpers/formatters.mjs';
import readDirectoryNames from '../src/app/helpers/read-dir-names.mjs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MAIN_DIR = `${__dirname}/../`;


const exampleData = {};

if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/`);
}

readDirectoryNames(`${MAIN_DIR}/src/examples/`).forEach(function (category) {
    exampleData[category] = {};
    const examples = fs.readdirSync(`${MAIN_DIR}/src/examples/${category}`);
    examples.forEach((exampleName) => {
        if (exampleName.includes('index.mjs')) return;
        const example = exampleName.replace('.tsx', '');
        exampleData[category][example] = {};
        const exampleFileText = fs.readFileSync(
            `${MAIN_DIR}/src/examples/${category}/${exampleName}`,
            "utf8"
        );
        exampleData[category][example].typeScriptFunction = formatters.getTypeScriptFunctionFromText(exampleFileText);
        exampleData[category][example].javaScriptFunction = Prettier.format(Babel.transform(exampleData[category][example].typeScriptFunction, { retainLines: true, filename: `transformedScript.tsx`, presets: ["typescript"] }).code, { parser: BabelParser.parse, tabWidth: 4 });
        exampleData[category][example].nameSlug = example;
        exampleData[category][example].categorySlug = category;
        const files = formatters.retrieveStaticObject(exampleFileText, 'FILES');
        // eslint-disable-next-line no-eval
        if (files) exampleData[category][example].files = eval('(' + files + ')');
    });
});

fs.writeFileSync(`${MAIN_DIR}/dist/example-data.js`, `const exampleData = ${JSON.stringify(exampleData)}; module.exports = exampleData;`);
