import { extractTextureTransform } from './khr-texture-transform.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen
const KHR_materials_sheen = {
    apply(data, material, textures) {
        material.useSheen = true;
        if (data.hasOwnProperty('sheenColorFactor')) {
            const [r, g, b] = data.sheenColorFactor;
            material.sheen.set(r, g, b).gamma();
        } else {
            material.sheen.set(1, 1, 1);
        }
        if (data.hasOwnProperty('sheenColorTexture')) {
            material.sheenMap = textures[data.sheenColorTexture.index];
            extractTextureTransform(data.sheenColorTexture, material, ['sheen']);
        }

        material.sheenGloss = data.hasOwnProperty('sheenRoughnessFactor') ? data.sheenRoughnessFactor : 0.0;

        if (data.hasOwnProperty('sheenRoughnessTexture')) {
            material.sheenGlossMap = textures[data.sheenRoughnessTexture.index];
            material.sheenGlossMapChannel = 'a';
            extractTextureTransform(data.sheenRoughnessTexture, material, ['sheenGloss']);
        }

        material.sheenGlossInvert = true;
    },

    getColorTextures(data) {
        return data.hasOwnProperty('sheenColorTexture') ? [data.sheenColorTexture] : [];
    }
};

export { KHR_materials_sheen };
