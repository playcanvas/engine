import fs from 'fs';

/** @import { Plugin } from 'rollup' */

const SHARE_TEMPLATE = fs.readFileSync('templates/share.html', 'utf-8');

/**
 * This plugin builds the share HTML file for the example.
 *
 * @param {object} data - The data.
 * @param {string} data.categoryKebab - The category kebab name.
 * @param {string} data.exampleNameKebab - The example kebab name.
 * @returns {Plugin} The plugin.
 */
export const buildShare = ({ categoryKebab, exampleNameKebab }) => {
    return {
        name: 'build-share',
        buildEnd() {
            const html = SHARE_TEMPLATE
            .replace(/@PATH/g, `${categoryKebab}/${exampleNameKebab}`)
            .replace(/@TITLE/g, `${exampleNameKebab.split('-').join(' ')}`)
            .replace(/@THUMB/g, `${categoryKebab}_${exampleNameKebab}_large`);
            if (/'@[A-Z0-9_]+'/.test(html)) {
                throw new Error('HTML file still has unreplaced values');
            }

            const dirPath = `dist/share/${categoryKebab}_${exampleNameKebab}`;
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            fs.writeFileSync(`${dirPath}/index.html`, html);
        }
    };
};
