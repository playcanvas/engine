import { LIGHTTYPE_DIRECTIONAL } from '../../constants.js';

const LitOptionsUtils = {

    // generate a key for the lit options
    generateKey(options) {
        return `lit${Object.keys(options)
        .sort()
        .map((key) => {
            if (key === 'shaderChunks') {
                return options.shaderChunks?.key ?? '';
            } else if (key === 'lights') {
                return LitOptionsUtils.generateLightsKey(options);
            }
            return key + options[key];
        })
        .join('\n')}`;
    },

    generateLightsKey(options) {
        return `lights:${options.lights.map((light) => {
            return (!options.clusteredLightingEnabled || light._type === LIGHTTYPE_DIRECTIONAL) ? `${light.key},` : '';
        }).join('')}`;
    }
};

export { LitOptionsUtils };
