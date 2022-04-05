import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import formatters from '../src/app/helpers/formatters.mjs';
/* eslint-disable no-await-in-loop */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAIN_DIR = `${__dirname}/../`;

fs.readdirSync(`${MAIN_DIR}/src/examples/`).forEach(function (category) {
    if (category.includes('index.mjs')) return;
    const examples = fs.readdirSync(`${MAIN_DIR}/src/examples/${category}`);
    examples.forEach((exampleName) => {
        if (exampleName.includes('index.mjs')) return;
        const example = exampleName.replace('.tsx', '');
        let exampleFileText = fs.readFileSync(
            `${MAIN_DIR}/src/examples/${category}/${exampleName}`,
            "utf8"
        );
        exampleFileText = exampleFileText.replace('import { AssetLoader } from \'../../app/helpers/loader\';\n', '');
        const loadFunctionText = formatters.getLoadFunctionFromText(exampleFileText);
        if (!loadFunctionText.includes('<ScriptLoader')) {
            exampleFileText = exampleFileText.replace(loadFunctionText + '\n', '');
        }
        const assets = formatters.getAssetsFromLoadFunction(loadFunctionText);
        if (assets) {
            exampleFileText = formatters.removeAssetsFromSignature(exampleFileText);
            const innerFunctionText = formatters.getInnerFunctionText(exampleFileText);
            const appCall = formatters.getAppCallFromText(exampleFileText);
            const splitFunction = innerFunctionText.split(appCall);
            splitFunction[1] = splitFunction[1].split('\n').map((line) => {
                if (line === '') return line;
                return '    ' + line;
            }).join('\n');
            splitFunction[1] = splitFunction[1].substring(0, splitFunction[1].length - 2) + '});\n    }\n';
            exampleFileText = exampleFileText.replace(innerFunctionText, splitFunction[0] + appCall + '\n' + assets + splitFunction[1]);
            // exampleFileText = exampleFileText.replace(formatters.getInnerFunctionText(exampleFileText), formatters.getInnerFunctionText(exampleFileText) + '); \n }');
        }
        fs.writeFileSync(`${MAIN_DIR}/src/examples/${category}/${example}.tsx`, exampleFileText);
    });
});

// fs.writeFileSync(`${MAIN_DIR}/dist/example-data.js`, `const exampleData = ${JSON.stringify(exampleData)}; module.exports = exampleData;`);
