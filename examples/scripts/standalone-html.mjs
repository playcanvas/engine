/**
 * This script is used to generate the standalone HTML file for the iframe to view the example.
 */
import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { exampleMetaData } from '../cache/metadata.mjs';
import { parseConfig, engineFor, patchScript } from './utils.mjs';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const MAIN_DIR = `${dirname(__filename)}/../`;
const EXAMPLE_HTML = fs.readFileSync(`${MAIN_DIR}/iframe/example.html`, 'utf-8');
const DIR_CACHE = new Map();

const TEMPLATE_CONTROLS = `/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ fragment }) {
    return fragment();
}\n`;

/**
 * @param {string} categoryKebab - The category kebab name.
 * @param {string} exampleNameKebab - The example kebab name.
 * @param {import('./utils.mjs').Engine | undefined} setEngineType - The engine type.
 * @param {string[]} files - The files in the example directory.
 * @returns {string} File to write as standalone example.
 */
function generateExampleFile(categoryKebab, exampleNameKebab, setEngineType, files) {
    let html = EXAMPLE_HTML;

    // title
    html = html.replace(/'@TITLE'/g, `${categoryKebab}: ${exampleNameKebab}`);

    // js files
    html = html.replace(/'@FILES'/g, JSON.stringify(files));

    // engine
    const engineType = process.env.ENGINE_PATH ? 'development' : process.env.NODE_ENV === 'development' ? 'debug' : setEngineType;
    const engine = engineFor(engineType);
    html = html.replace(/'@ENGINE'/g, JSON.stringify(engine));

    if (/'@([A-Z0-9_]+)'/g.test(html)) {
        throw new Error('HTML file still has unreplaced values');
    }

    return html;
}

function main() {
    if (!fs.existsSync(`${MAIN_DIR}/dist/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/`);
    }
    if (!fs.existsSync(`${MAIN_DIR}/dist/iframe/`)) {
        fs.mkdirSync(`${MAIN_DIR}/dist/iframe/`);
    }

    exampleMetaData.forEach((data) => {
        const { categoryKebab, exampleNameKebab, path } = data;
        const name = `${categoryKebab}_${exampleNameKebab}`;

        if (!DIR_CACHE.has(path)) {
            DIR_CACHE.set(path, fs.readdirSync(path));
        }

        /**
         * @type {string[]}
         */
        const files = [];
        for (const file of DIR_CACHE.get(path)) {
            if (file.startsWith(`${exampleNameKebab}.`)) {
                files.push(file.replace(`${exampleNameKebab}.`, ''));
            }
        }
        if (!files.includes('example.mjs')) {
            throw new Error(`Example ${name} is missing an example.mjs file`);
        }
        if (!files.includes('controls.mjs')) {
            files.push('controls.mjs');
        }

        files.forEach((file) => {
            if (file === 'example.mjs') {
                const examplePath = resolve(path, `${exampleNameKebab}.${file}`);

                // example file
                const script = fs.readFileSync(examplePath, 'utf-8');
                fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.example.mjs`, patchScript(script));

                // html file
                const config = parseConfig(script);
                const out = generateExampleFile(categoryKebab, exampleNameKebab, config.ENGINE, files);
                fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.html`, out);
                return;
            }

            if (file === 'controls.mjs') {
                const controlsPath = resolve(path, `${exampleNameKebab}.${file}`);
                const controlsExist = fs.existsSync(controlsPath);

                // controls file
                const script = controlsExist ? fs.readFileSync(controlsPath, 'utf-8') : TEMPLATE_CONTROLS;
                fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.controls.mjs`, patchScript(script));
                return;
            }

            const scriptPath = resolve(path, `${exampleNameKebab}.${file}`);
            let script = fs.readFileSync(scriptPath, 'utf-8');
            if (/\.(mjs|js)$/.test(file)) {
                script = patchScript(script);
            }
            fs.writeFileSync(`${MAIN_DIR}/dist/iframe/${name}.${file}`, script);
        });
    });
}
main();
