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
 * @param {'DEVELOPMENT' | 'PERFORMANCE' | 'DEBUG' | undefined} type - The engine type.
 * @returns {string} - The build file.
 */
function engineFor(type) {
    switch (type) {
        case 'DEVELOPMENT':
            return './playcanvas.dev.js';
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
 * @param {string} categoryPascal - The category pascal name.
 * @param {string} exampleNamePascal - The example pascal name.
 * @param {ExampleClass} exampleClass - The example class.
 * @returns {string} File to write as standalone example.
 */
function generateExampleFile(categoryPascal, exampleNamePascal, exampleClass) {
    let html = EXAMPLE_HTML;

    // title
    html = html.replace(/'@TITLE'/g, `${categoryPascal}: ${exampleNamePascal}`);

    // es5 scripts
    const es5Str = exampleClass.es5libs?.map((/** @type {string} */ src) => `<script src="${src}"></script>`).join('\n') || '';
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

    // module
    html = html.replace(/'@MODULE'/g, JSON.stringify(`./${categoryPascal}_${exampleNamePascal}.js`));

    // engine
    const engineType = process.env.ENGINE_PATH ? 'DEVELOPMENT' : process.env.NODE_ENV === 'development' ? 'DEBUG' : exampleClass.ENGINE;
    const engine = engineFor(engineType);
    html = html.replace(/'@ENGINE'/g, JSON.stringify(engine));

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

        // html files
        const exampleImport = await import(`file://${path}`);
        const exampleClass = Object.values(exampleImport)[0];
        const out = generateExampleFile(categoryPascal, exampleNamePascal, exampleClass);
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${categoryPascal}_${exampleNamePascal}.html`, out);

        // js files
        let script = fs.readFileSync(path, 'utf-8');
        script = script.replace(/\s*import[\s\w*]+["']playcanvas["']\s*;?[\s\r\n]*/g, '');
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${categoryPascal}_${exampleNamePascal}.js`, script);
    }));

    return 0;
}
main().then(process.exit);
