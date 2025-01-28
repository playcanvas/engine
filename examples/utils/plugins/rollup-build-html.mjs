import fs from 'fs';

import { parseConfig } from '../../scripts/utils.mjs';

/** @import { Plugin } from 'rollup' */

const EXAMPLE_HTML = fs.readFileSync('iframe/example.html', 'utf-8');

/**
 * Choose engine based on `Example#ENGINE`, e.g. ClusteredLightingExample picks PERFORMANCE.
 *
 * @param {'development' | 'performance' | 'debug'  | undefined} type - The engine type.
 * @returns {string} - The build file.
 */
export const engineUrl = (type) => {
    switch (type) {
        case 'development':
            return './ENGINE_PATH/index.js';
        case 'performance':
            return './playcanvas.prf.mjs';
        case 'debug':
            return './playcanvas.dbg.mjs';
    }
    return './playcanvas.mjs';
};

/**
 * This plugin builds the HTML file for the example.
 *
 * @param {object} data - The data.
 * @param {string} data.categoryKebab - The category kebab name.
 * @param {string} data.exampleNameKebab - The example kebab name.
 * @param {string[]} data.files - The files in the example directory.
 * @param {string} data.enginePath - The engine path.
 * @param {string} data.nodeEnv - The node environment.
 * @returns {Plugin} The plugin.
 */
export const buildHtml = ({ categoryKebab, exampleNameKebab, files, enginePath, nodeEnv }) => {
    return {
        name: 'build-html',
        transform(code) {
            const config = parseConfig(code);
            const engineType = enginePath ? 'development' : nodeEnv === 'development' ? 'debug' : config.ENGINE;

            // Apply templating
            const html = EXAMPLE_HTML
            .replace(/'@TITLE'/g, `${categoryKebab}: ${exampleNameKebab}`)
            .replace(/'@FILES'/g, JSON.stringify(files))
            .replace(/'@ENGINE'/g, JSON.stringify(engineUrl(engineType)));
            if (/'@[A-Z0-9_]+'/.test(html)) {
                throw new Error('HTML file still has unreplaced values');
            }

            fs.writeFileSync(`dist/iframe/${categoryKebab}_${exampleNameKebab}.html`, html);

            return {
                code,
                map: null
            };
        }
    };
};
