import { extractTextureTransform } from './khr-texture-transform.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_clearcoat
const KHR_materials_clearcoat = {
    apply(data, material, textures) {
        if (data.hasOwnProperty('clearcoatFactor')) {
            material.clearCoat = data.clearcoatFactor * 0.25; // TODO: remove temporary workaround for replicating glTF clear-coat visuals
        } else {
            material.clearCoat = 0;
        }
        if (data.hasOwnProperty('clearcoatTexture')) {
            const clearcoatTexture = data.clearcoatTexture;
            material.clearCoatMap = textures[clearcoatTexture.index];
            material.clearCoatMapChannel = 'r';

            extractTextureTransform(clearcoatTexture, material, ['clearCoat']);
        }
        if (data.hasOwnProperty('clearcoatRoughnessFactor')) {
            material.clearCoatGloss = data.clearcoatRoughnessFactor;
        } else {
            material.clearCoatGloss = 0;
        }
        if (data.hasOwnProperty('clearcoatRoughnessTexture')) {
            const clearcoatRoughnessTexture = data.clearcoatRoughnessTexture;
            material.clearCoatGlossMap = textures[clearcoatRoughnessTexture.index];
            material.clearCoatGlossMapChannel = 'g';

            extractTextureTransform(clearcoatRoughnessTexture, material, ['clearCoatGloss']);
        }
        if (data.hasOwnProperty('clearcoatNormalTexture')) {
            const clearcoatNormalTexture = data.clearcoatNormalTexture;
            material.clearCoatNormalMap = textures[clearcoatNormalTexture.index];

            extractTextureTransform(clearcoatNormalTexture, material, ['clearCoatNormal']);

            if (clearcoatNormalTexture.hasOwnProperty('scale')) {
                material.clearCoatBumpiness = clearcoatNormalTexture.scale;
            } else {
                material.clearCoatBumpiness = 1;
            }
        }

        material.clearCoatGlossInvert = true;
    }
};

export { KHR_materials_clearcoat };
