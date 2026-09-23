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
        // A light's slot is part of the shader it generates - light<N>_ names are emitted per slot -
        // and `options.lights` is indexed by slot and sparse, so the slot each light sits in has to
        // be in the key. Keying on the sequence of lights alone would let two layouts of the same
        // lights, say slots [0, 1] and [0, 2], share a cached shader declaring the wrong slot.
        const lights = options.lights;
        let key = 'lights:';
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];
            if (light && (!options.clusteredLightingEnabled || light._type === LIGHTTYPE_DIRECTIONAL)) {
                key += `${i}:${light.key},`;
            }
        }
        return key;
    }
};

export { LitOptionsUtils };
