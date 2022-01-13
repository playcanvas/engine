const fs = require("fs");
const BabelParser = require('@babel/parser');
const Prettier = require('prettier/standalone');
const Babel = require('@babel/standalone');
const formatters = require('../src/app/helpers/formatters.js');

const MAIN_DIR = `${__dirname}/../`;

const exampleData = {};

if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/`);
}

fs.readdirSync(`${MAIN_DIR}/src/examples/`).forEach(function (category) {
    if (category.includes('index.js')) return;
    exampleData[category] = {};
    const examples = fs.readdirSync(`${MAIN_DIR}/src/examples/${category}`);
    examples.forEach((exampleName) => {
        if (exampleName.includes('index.js')) return;
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
    });
});

fs.writeFileSync(`${MAIN_DIR}/dist/example-data.js`, `const exampleData = ${JSON.stringify(exampleData)}; module.exports = exampleData;`);
