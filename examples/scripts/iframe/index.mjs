import fs from 'fs';
import fse from 'fs-extra';
import Babel from '@babel/standalone';
import Handlebars from 'handlebars';
import formatters from '../../src/app/helpers/formatters.mjs';
import readDirectoryNames from '../../src/app/helpers/read-dir-names.mjs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAIN_DIR = `${__dirname}/../../`;

// copy prebuilt files used by the iframe
fse.copySync(`${MAIN_DIR}/../build/`, `${MAIN_DIR}/dist/build/`);
fs.copyFileSync(`${MAIN_DIR}/./node_modules/@playcanvas/observer/dist/index.js`, `${MAIN_DIR}/dist/build/playcanvas-observer.js`);
fs.copyFileSync(`${MAIN_DIR}/./node_modules/url-search-params-polyfill/index.js`, `${MAIN_DIR}/dist/build/urlSearchParamsPolyfill.js`);
fs.copyFileSync(`${MAIN_DIR}/./node_modules/promise-polyfill/dist/polyfill.min.js`, `${MAIN_DIR}/dist/build/promisePolyfill.js`);
fs.copyFileSync(`${MAIN_DIR}/./node_modules/whatwg-fetch/dist/fetch.umd.js`, `${MAIN_DIR}/dist/build/fetchPolyfill.js`);
fs.copyFileSync(`${MAIN_DIR}/./node_modules/regenerator-runtime/runtime.js`, `${MAIN_DIR}/dist/build/regeneratorRuntimePolyfill.js`);
fs.copyFileSync(`${MAIN_DIR}/lib/arrayFromPolyfill.js`, `${MAIN_DIR}/dist/build/arrayFromPolyfill.js`);
fs.copyFileSync(`${MAIN_DIR}/lib/objectValuesPolyfill.js`, `${MAIN_DIR}/dist/build/objectValuesPolyfill.js`);

function loadHtmlTemplate(data) {
    const html = fs.readFileSync(`${MAIN_DIR}/scripts/iframe/index.mustache`, "utf8");
    const template = Handlebars.compile(html);
    return template(data);
}

function buildExample(category, filename) {
    const exampleString = fs.readFileSync(
        `${MAIN_DIR}/src/examples/${category}/${filename}`,
        "utf8"
    );

    const exampleClass = formatters.getExampleClassFromTextFile(Babel, exampleString);
    if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/${category}/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/iframe/${category}/`);
    }
    let enginePath;
    switch (formatters.getEngineTypeFromClass(exampleClass)) {
        case "DEBUG":
            enginePath = '/build/playcanvas.dbg.js';
            break;
        case "PERFORMANCE":
            enginePath = '/build/playcanvas.prf.js';
            break;
        default:
            enginePath = '/build/playcanvas.js';
            break;
    }
    fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${category}/${filename.replace(".tsx", "")}.html`, loadHtmlTemplate({
        exampleClass: exampleClass,
        enginePath: process.env.ENGINE_PATH || enginePath,
        webgpuEnabled: formatters.getWebgpuEnabledFromClass(exampleClass),
        miniStats: !formatters.classIncludesMiniStats(exampleClass)
    }));
}

if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/iframe/`);
}

if (process.env.EXAMPLE && process.env.CATEGORY) {
    buildExample(process.env.CATEGORY, `${process.env.EXAMPLE}.tsx`);
} else {
    readDirectoryNames(`${MAIN_DIR}/src/examples/`).forEach((category) => {
        const exampleFilenames = fs.readdirSync(`${MAIN_DIR}/src/examples/${category}`);
        exampleFilenames.forEach((exampleFilename) => {
            if (exampleFilename.includes('index.mjs')) return;
            buildExample(category, exampleFilename);
        });
    });
}
