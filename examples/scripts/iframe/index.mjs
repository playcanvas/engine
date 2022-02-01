import fs from 'fs';
import fse from 'fs-extra';
import Babel from '@babel/standalone';
import Handlebars from 'handlebars';
import formatters from '../../src/app/helpers/formatters.mjs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAIN_DIR = `${__dirname}/../../`;

// copy prebuilt files used by the iframe
fse.copySync(`${MAIN_DIR}/../build/`, `${MAIN_DIR}/dist/build/`);
fs.copyFileSync(`${MAIN_DIR}/lib/wasm-loader.js`, `${MAIN_DIR}/dist/build/wasm-loader.js`);
fs.copyFileSync(`${MAIN_DIR}/./node_modules/@playcanvas/observer/dist/index.js`, `${MAIN_DIR}/dist/build/playcanvas-observer.js`);

const EXAMPLE_CONSTS = [
    "vshader",
    "fshader",
    "fshaderFeedback",
    "fshaderCloud",
    "vshaderFeedback",
    "vshaderCloud"
];

function retrieveConstString(data, name) {
    const start = data.indexOf(`const ${name} = `);
    if (start < 0) return;
    const end = data.indexOf("`;", start);
    return data.substring(start + name.length + 10, end);
}

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

    const exampleConstValues = EXAMPLE_CONSTS
        .map(k => ({ k, v: retrieveConstString(exampleString, k) }))
        .filter(c => c.v);

    const exampleClass = formatters.getExampleClassFromTextFile(Babel, exampleString);
    if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/${category}/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/iframe/${category}/`);
    }
    fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${category}/${filename.replace(".tsx", "")}.html`, loadHtmlTemplate({
        exampleClass: exampleClass,
        exampleConstValues: JSON.stringify(exampleConstValues),
        enginePath: process.env.ENGINE_PATH || '../../build/playcanvas.js'
    }));
}

if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/iframe/`);
}

if (process.env.EXAMPLE && process.env.CATEGORY) {
    buildExample(process.env.CATEGORY, `${process.env.EXAMPLE}.tsx`);
} else {
    const categories = fs.readdirSync(`${MAIN_DIR}/src/examples/`);
    categories.forEach((category) => {
        if (category.includes('index.mjs')) return;
        const exampleFilenames = fs.readdirSync(`${MAIN_DIR}/src/examples/${category}`);
        exampleFilenames.forEach((exampleFilename) => {
            if (exampleFilename.includes('index.mjs')) return;
            buildExample(category, exampleFilename);
        });
    });
}
