/**
 * This script is used to generate the standalone HTML file for the iframe to view the example.
 */
import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { exampleMetaData } from '../cache/metadata.mjs';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;
const EXAMPLE_HTML = fs.readFileSync(`${MAIN_DIR}/iframe/example.html`, 'utf-8');

const TEMPLATE_CONFIG = `export default {};\n`;
const TEMPLATE_CONTROLS = `/**
 * @param {import('../../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ fragment }) {
    return fragment();
}\n`;

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
            return './ENGINE_PATH/index.js';
        case 'PERFORMANCE':
            return './playcanvas.prf.mjs';
        case 'DEBUG':
            return './playcanvas.dbg.mjs';
    }
    return './playcanvas.mjs';
}

/**
 * @param {string} categoryKebab - The category kebab name.
 * @param {string} exampleNameKebab - The example kebab name.
 * @param {import('../types.mjs').ExampleConfig} config - The example config.
 * @returns {string} File to write as standalone example.
 */
function generateExampleFile(categoryKebab, exampleNameKebab, config) {
    let html = EXAMPLE_HTML;

    // title
    html = html.replace(/'@TITLE'/g, `${categoryKebab}: ${exampleNameKebab}`);

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

    // js files
    const name = `${categoryKebab}_${exampleNameKebab}`;
    html = html.replace(/'@EXAMPLE'/g, JSON.stringify(`./${name}.example.mjs`));
    html = html.replace(/'@CONTROLS'/g, JSON.stringify(`./${name}.controls.mjs`));
    html = html.replace(/'@CONFIG'/g, JSON.stringify(`./${name}.config.mjs`));

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
    script = script.replace(/\s*import[\s\w*{},]+["']playcanvas["']\s*;?[\s\r\n]*/g, '');
    script = script.replace(/\s*import[\s\w*{},]+["']playcanvas-extras["']\s*;?[\s\r\n]*/g, '');

    return script;
}

async function main() {
    if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/`);
    }
    if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/iframe/`);
    }

    await Promise.all(exampleMetaData.map(async (data) => {
        const { categoryKebab, exampleNameKebab, path } = data;
        const name = `${categoryKebab}_${exampleNameKebab}`;
        const examplePath = resolve(path, 'example.mjs');
        const controlsPath = resolve(path, 'controls.mjs');
        const configPath = resolve(path, 'config.mjs');

        const controlsExist = fs.existsSync(controlsPath);
        const configExists = fs.existsSync(configPath);

        const config = configExists ? (await import(`file://${configPath}`)).default : {};

        // html file
        const out = generateExampleFile(categoryKebab, exampleNameKebab, config);
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.html`, out);

        // example file
        let script = fs.readFileSync(examplePath, 'utf-8');
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.example.mjs`, patchScript(script));

        // controls file
        script = controlsExist ? fs.readFileSync(controlsPath, 'utf-8') : TEMPLATE_CONTROLS;
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.controls.mjs`, patchScript(script));

        // config files
        script = configExists ? fs.readFileSync(configPath, 'utf-8') : TEMPLATE_CONFIG;
        fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.config.mjs`, script);
    }));

    return 0;
}
main().then(process.exit);
