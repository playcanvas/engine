import { LIGHTTYPE_DIRECTIONAL } from "../../constants.js";

const LitOptionsUtils = {

    // generate a key for the lit options
    generateKey(options) {
        return "lit" + Object.keys(options)
            .sort()
            .map((key) => {
                if (key === "chunks") {
                    return LitOptionsUtils.generateChunksKey(options);
                } else if (key === "lights") {
                    return LitOptionsUtils.generateLightsKey(options);
                }
                return key + options[key];
            })
            .join("\n");
    },

    generateLightsKey(options) {
        return 'lights:' + options.lights.map((light) => {
            return (!options.clusteredLightingEnabled || light._type === LIGHTTYPE_DIRECTIONAL) ? `${light.key},` : '';
        }).join("");
    },

    generateChunksKey(options) {
        return 'chunks:\n' + Object.keys(options.chunks ?? {})
            .sort()
            .map(key => key + options.chunks[key])
            .join("");
    }
};

export { LitOptionsUtils };
