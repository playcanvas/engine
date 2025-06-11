/** @import { Plugin } from 'rollup' */

/**
 * This plugin removes all PlayCanvas imports from the code.
 *
 * @returns {Plugin} - The plugin.
 */
export const removePc = () => {
    return {
        name: 'remove-pc',
        transform(code) {
            code = code.replace(/ *import[\s\w*{},]+["']playcanvas["'] *;?\s*/g, '');

            return {
                code,
                map: null
            };
        }
    };
};
