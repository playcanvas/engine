/**
 * This script is used to generate the standalone HTML file for the iframe to view the example.
 */
import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as realExamples from "../src/examples/index.mjs";
import { toKebabCase } from '../src/app/helpers/strings.mjs';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;
const EXAMPLE_HTML = fs.readFileSync(`${MAIN_DIR}/iframe/example.html`, 'utf-8');

/**
 * @type {Record<string, Record<string, {
 *  example: string,
 *  nameSlug: string,
 *  categorySlug: string,
 *  files: any,
 *  controls: string
 * }>>}
 */
const exampleData = {};
if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/`);
}
if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/`)) {
    fs.mkdirSync(`${MAIN_DIR}/dist/iframe/`);
}
for (const category_ in realExamples) {
    const category = toKebabCase(category_);
    exampleData[category] = {};
    // @ts-ignore
    const examples = realExamples[category_];
    for (const exampleName_ in examples) {
        const exampleClass = examples[exampleName_];
        const example = toKebabCase(exampleName_).replace('-example', '');
        const exampleFunc = exampleClass.example.toString();
        exampleData[category][example] = {
            example: exampleFunc,
            nameSlug: example,
            categorySlug: category,
            files: undefined,
            controls: ''
        };
        if (exampleClass.FILES) {
            exampleData[category][example].files = exampleClass.FILES;
        }
        if (exampleClass.controls) {
            exampleData[category][example].controls = exampleClass.controls.toString();
        }
        const dropEnding = exampleName_.replace(/Example$/, ""); // TestExample -> Test
        const out = generateExampleFile(category_, dropEnding, exampleClass);
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${category_}_${dropEnding}.html`, out);
    }
}

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
    const importsStr = `<script>${exampleClass.imports?.map((/** @type {{ toString: () => any; }} */ _) => _.toString()).join('\n\n') || ''}</script>`;
    html = html.replace(/'@IMPORTS'/g, importsStr);

    // controls
    html = html.replace(/'@CONTROLS'/g, `<script>${exampleClass.controls?.toString() || ''}</script>`);

    // example
    html = html.replace(/'@EXAMPLE'/g, `<script>${exampleClass.example.toString()}</script>`);

    // engine path
    html = html.replace(/'@ENGINE_PATH'/g, JSON.stringify(process.env.ENGINE_PATH ?? ''));

    // node env
    html = html.replace(/'@NODE_ENV'/g, JSON.stringify(process.env.NODE_ENV ?? ''));

    // webGPU enabled
    html = html.replace(/'@WEBGPU_ENABLED'/g, `${!!exampleClass.WEBGPU_ENABLED}`);

    // engine
    html = html.replace(/'@ENGINE'/g, JSON.stringify(engineFor(exampleClass.ENGINE)));
    html = html.replace(/'@DEBUG_ENGINE'/g, JSON.stringify(engineFor('DEBUG')));

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
