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
 * @param {string | undefined} type - The engine type.
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
 * @param {string} categoryPascal - The category pascal name.
 * @param {string} exampleNamePascal - The example pascal name.
 * @param {{
 *      INCLUDE_AR_LINK?: boolean,
 *      NO_CANVAS?: boolean
 *      ENGINE?: 'DEVELOPMENT' | 'PERFORMANCE' | 'DEBUG' | string | undefined
 * }} config - The example config.
 * @returns {string} File to write as standalone example.
 */
function generateExampleFile(categoryPascal, exampleNamePascal, config) {
    let html = EXAMPLE_HTML;

    // title
    html = html.replace(/'@TITLE'/g, `${categoryPascal}: ${exampleNamePascal}`);

    // AR Link
    const arLinkStr = config.INCLUDE_AR_LINK ? `<div style="width:100%; position:absolute; top:10px">
        <div style="text-align: center;">
            <a id="ar-link" rel="ar" download="asset.usdz">
                <img src="./arkit.png" id="button" width="200"/>
            </a>    
        </div>
    </div>` : '';
    html = html.replace(/'@AR_LINK'/g, arLinkStr);

    // canvas
    html = html.replace(/'@CANVAS'/g, config.NO_CANVAS ? '' : '<canvas id="application-canvas"></canvas>');

    // module
    html = html.replace(/'@MODULE'/g, JSON.stringify(`./${categoryPascal}_${exampleNamePascal}.js`));

    // engine
    const engineType = process.env.ENGINE_PATH ? 'DEVELOPMENT' : process.env.NODE_ENV === 'development' ? 'DEBUG' : config.ENGINE;
    const engine = engineFor(engineType);
    html = html.replace(/'@ENGINE'/g, JSON.stringify(engine));

    if (/'@([A-Z0-9_]+)'/g.test(html)) {
        throw new Error('HTML file still has unreplaced values');
    }

    return html;
}

/**
 * @param {string} script - The script to be patched.
 * @returns {string} - The patched script.
 */
function patchScript(script) {
    // remove playcanvas & playcanvas-extras imports
    script = script.replace(/\s*import[\s\w*{}]+["']playcanvas["']\s*;?[\s\r\n]*/g, '');
    script = script.replace(/\s*import[\s\w*{}]+["']playcanvas-extras["']\s*;?[\s\r\n]*/g, '');

    return script;
}

function main() {
    if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/`);
    }
    if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/iframe/`);
    }

    exampleMetaData.forEach((data) => {
        const { categoryPascal, exampleNamePascal, path, config } = data;

        // html files
        const out = generateExampleFile(categoryPascal, exampleNamePascal, config);
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${categoryPascal}_${exampleNamePascal}.html`, out);

        // js files
        const script = fs.readFileSync(path, 'utf-8');
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${categoryPascal}_${exampleNamePascal}.js`, patchScript(script));
    });
}
main();
