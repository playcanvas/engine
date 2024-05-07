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
            return './playcanvas.prf/src/index.js';
        case 'DEBUG':
            return './playcanvas.dbg/src/index.js';
    }
    return './playcanvas/src/index.js';
}

/**
 * @param {string} categoryKebab - The category kebab name.
 * @param {string} exampleNameKebab - The example kebab name.
 * @param {import('../types.mjs').ExampleConfig} config - The example config.
 * @param {string[]} files - The files in the example directory.
 * @returns {string} File to write as standalone example.
 */
function generateExampleFile(categoryKebab, exampleNameKebab, config, files) {
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
    html = html.replace(/'@CONFIG'/g, JSON.stringify(`./${name}.config.mjs`));
    html = html.replace(/'@FILES'/g, JSON.stringify(files));

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
 * @param {string} script - The script to parse.
 * @returns {import('../types.mjs').ExampleConfig} - The parsed config.
 */
function parseConfig(script) {
    const regex = /\/\/ @flag ([^ \n]+) ?([^\n]+)?/g;
    let match;
    /** @type {Record<string, any>} */
    const config = {};
    while ((match = regex.exec(script)) !== null) {
        config[match[1]] = match[2] ?? true;
    }
    return config;
}

/**
 * @param {string} script - The script to be patched.
 * @returns {string} - The patched script.
 */
function patchScript(script) {
    // remove playcanvas imports
    script = script.replace(/ *import[\s\w*{},]+["']playcanvas["'] *;?[\s\r\n]*/g, '');

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

        const files = fs.readdirSync(path);
        if (!files.includes('example.mjs')) {
            throw new Error(`Example ${name} is missing an example.mjs file`);
        }
        if (!files.includes('controls.mjs')) {
            files.push('controls.mjs');
        }
        if (!files.includes('config.mjs')) {
            files.push('config.mjs');
        }

        await Promise.all(files.map(async (file) => {
            if (file === 'example.mjs') {
                const examplePath = resolve(path, file);

                // example file
                const script = fs.readFileSync(examplePath, 'utf-8');
                const config = parseConfig(script);
                console.log(config);
                fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.example.mjs`, patchScript(script));
                return;
            }

            if (file === 'controls.mjs') {
                const controlsPath = resolve(path, file);
                const controlsExist = fs.existsSync(controlsPath);

                // controls file
                const script = controlsExist ? fs.readFileSync(controlsPath, 'utf-8') : TEMPLATE_CONTROLS;
                fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.controls.mjs`, patchScript(script));
                return;
            }

            if (file === 'config.mjs') {
                const configPath = resolve(path, file);
                const configExists = fs.existsSync(configPath);
                const config = configExists ? (await import(`file://${configPath}`)).default : {};

                const configFlags = Object.keys(config).map((key) => {
                    if (typeof config[key] === 'string') {
                        return `// @flag ${key} "${config[key]}"`;
                    }
                    return `// @flag ${key}`;
                }).join('\n');
                if (configFlags) {
                    const examplePath = resolve(path, 'example.mjs');
                    const contents = fs.readFileSync(examplePath, 'utf-8');
                    fs.writeFileSync(examplePath, `${configFlags}\n${contents}`);
                    fs.unlinkSync(configPath);
                }
                return;


                // // html file
                // const out = generateExampleFile(categoryKebab, exampleNameKebab, config, files);
                // fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.html`, out);

                // // config files
                // const script = configExists ? fs.readFileSync(configPath, 'utf-8') : TEMPLATE_CONFIG;
                // fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.config.mjs`, script);
                // return;
            }

            const scriptPath = resolve(path, file);
            const script = fs.readFileSync(scriptPath, 'utf-8');
            fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.${file}`, script);
        }));
    }));

    return 0;
}
main().then(process.exit);
