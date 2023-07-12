import { LIGHTTYPE_DIRECTIONAL } from "../constants.js";

const collectLights = (lType, lights, lightsFiltered, mask, staticLightList) => {
    for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        if (light.enabled) {
            if (light.mask & mask) {
                if (lType !== LIGHTTYPE_DIRECTIONAL) {
                    if (light.isStatic) {
                        continue;
                    }
                }
                lightsFiltered.push(light);
            }
        }
    }

    if (staticLightList) {
        for (let i = 0; i < staticLightList.length; i++) {
            const light = staticLightList[i];
            if (light._type === lType) {
                lightsFiltered.push(light);
            }
        }
    }
};

export { collectLights };
