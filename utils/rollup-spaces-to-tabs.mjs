import { createFilter } from '@rollup/pluginutils';

/** @typedef {import('rollup').Plugin} Plugin */

/**
 * This plugin converts every two spaces into one tab. Two spaces is the default the babel plugin
 * outputs, which is independent of the four spaces of the code base.
 *
 * @param {boolean} enable - Enable or disable the plugin.
 * @returns {Plugin} The plugin.
 */
export function spacesToTabs(enable) {
    const filter = createFilter([
        '**/*.js'
    ], []);

    return {
        name: "spacesToTabs",
        transform(code, id) {
            if (!enable || !filter(id)) return undefined;
            // ^    = start of line
            // " +" = one or more spaces
            // gm   = find all + multiline
            const regex = /^ +/gm;
            code = code.replace(
                regex,
                startSpaces => startSpaces.replace(/ {2}/g, '\t')
            );
            return {
                code,
                map: null
            };
        }
    };
}
