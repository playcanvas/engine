import { LIGHTTYPE_DIRECTIONAL } from "../../constants.js";

const lit = {

    buildPropertiesList: function (options) {
        const props = [];
        for (const prop in options) {
            if (options.hasOwnProperty(prop) && prop !== "chunks" && prop !== "lights")
                props.push(prop);
        }
        return props.sort();
    },

    propertiesKey: function(props) {
        let key = "";
        for (let i = 0; i < props.length; i++) {
            if (props[i])
                key += props[i] + props[i];
        }
        return key;
    },

    litOptionsKey: function (options) {
        let key = "";
        for (const m in options) {

            // handle lights in a custom way
            if (m === 'lights') {
                const isClustered = options.clusteredLightingEnabled;
                for (let i = 0; i < options.lights.length; i++) {
                    const light = options.lights[i];
                    if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
                        key += light.key;
                    }
                }
            } else {
                key += m + options[m];
            }
        }
        return key;
    },

    chunksKey: function (chunks) {
        let key = "";
        if (chunks) {
            const chunks = [];
            for (const p in chunks) {
                if (chunks.hasOwnProperty(p)) {
                    chunks.push(p + chunks[p]);
                }
            }
            chunks.sort();
            key += chunks;
        }
        return key;
    }
};

export { lit };
