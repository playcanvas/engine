/**
 * This script is used to generate the standalone HTML file for the iframe to view the example.
 */
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { exampleMetaData } from '../cache/metadata.mjs';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;
const EXAMPLE_HTML = fs.readFileSync(`${MAIN_DIR}/iframe/example.html`, 'utf-8');

/**
 * Choose engine based on `Example#ENGINE`, e.g. ClusteredLightingExample picks:
 * static ENGINE = 'PERFORMANCE';
 *
 * @param {'PERFORMANCE' | 'DEBUG' | undefined} type - The engine type.
 * @returns {string} - The build file.
 */
function engineFor(type) {
    switch (type) {
        case 'PERFORMANCE':
            return './playcanvas.prf.js';
        case 'DEBUG':
            return './playcanvas.dbg.js';
    }
    return './playcanvas.js';
}

/**
 * @typedef {object} ExampleClass
 * @property {Function} example - The example function.
 * @property {Function} [controls] - The controls function.
 * @property {object[]} [imports] - The imports array.
 * @property {string[]} [es5libs] - The ES5Libs array.
 * @property {string} DESCRIPTION - The example description.
 * @property {'PERFORMANCE' | 'DEBUG' | undefined} ENGINE - The engine type.
 * @property {object} FILES - The object of extra files to include (e.g shaders).
 * @property {boolean} INCLUDE_AR_LINK - Include AR link png.
 * @property {boolean} NO_DEVICE_SELECTOR - No device selector.
 * @property {boolean} NO_CANVAS - No canvas element.
 * @property {boolean} NO_MINISTATS - No ministats.
 * @property {boolean} WEBGPU_ENABLED - If webGPU is enabled.
 */
/**
 * @param {string} category - The category.
 * @param {string} example - The example.
 * @param {ExampleClass} exampleClass - The example class.
 * @returns {string} File to write as standalone example.
 */
function generateExampleFile(category, example, exampleClass) {
    let html = EXAMPLE_HTML;

    // title
    html = html.replace(/'@TITLE'/g, `${category}: ${example}`);

    // es5 scripts
    const es5Str = exampleClass.es5libs?.map((/** @type {string} */ src) => `<script src="${src}"></script>`).join('\n') || '<!-- no es5libs -->';
    html = html.replace(/'@ES5_LIBS'/g, es5Str);

    // AR Link
    const arLinkStr = exampleClass.INCLUDE_AR_LINK ? `<div style="width:100%; position:absolute; top:10px">
        <div style="text-align: center;">
            <a id="ar-link" rel="ar" download="asset.usdz">
                <img src="./arkit.png" id="button" width="200"/>
            </a>    
        </div>
    </div>` : '';
    html = html.replace(/'@AR_LINK'/g, arLinkStr);

    // canvas
    html = html.replace(/'@CANVAS'/g, exampleClass.NO_CANVAS ? '' : '<canvas id="application-canvas"></canvas>');

    // imports
    const importsStr = `<script>${exampleClass.imports?.map((/** @type {{ toString: () => any; }} */ o) => o.toString()).join('\n\n') || ''}</script>`;
    html = html.replace(/'@IMPORTS'/g, importsStr);

    // example
    html = html.replace(/'@EXAMPLE'/g, exampleClass.example.toString());

    // controls
    html = html.replace(/'@CONTROLS'/g, exampleClass.controls?.toString() || '""');

    // webGPU enabled
    html = html.replace(/'@WEBGPU_ENABLED'/g, `${!!exampleClass.WEBGPU_ENABLED}`);

    // engine
    const engineType = process.env.NODE_ENV === 'development' ? 'DEBUG' : exampleClass.ENGINE;
    const enginePath = process.env.ENGINE_PATH ?? '';
    const engine = enginePath.length ? `./ENGINE_PATH/${enginePath.split('/').pop()}` : engineFor(engineType);
    html = html.replace(/'@ENGINE'/g, JSON.stringify(engine));

    // files
    html = html.replace(/'@FILES'/g, exampleClass.FILES ? JSON.stringify(exampleClass.FILES) : '{}');

    // ministats
    html = html.replace(/'@NO_MINISTATS'/g, `${!!exampleClass.NO_MINISTATS}`);

    // device selector
    html = html.replace(/'@DEVICE_SELECTOR'/g, `${!exampleClass.NO_DEVICE_SELECTOR}`);

    // description
    html = html.replace(/'@DESCRIPTION'/g, `${JSON.stringify(exampleClass.DESCRIPTION || '')}`);

    if (/'@([A-Z0-9_]+)'/g.test(html)) {
        throw new Error('HTML file still has unreplaced values');
    }

    return html;
}

async function main() {
    if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/`);
    }
    if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/iframe/`);
    }

    await Promise.all(exampleMetaData.map(async (data) => {
        const { categoryPascal, exampleNamePascal, path } = data;
        const exampleImport = await import(path);
        const exampleClass = Object.values(exampleImport)[0];
        const out = generateExampleFile(categoryPascal, exampleNamePascal, exampleClass);
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${categoryPascal}_${exampleNamePascal}.html`, out);
    }));

    return 0;
}
main().then(process.exit);
