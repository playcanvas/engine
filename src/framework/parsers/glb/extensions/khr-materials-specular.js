import { extractTextureTransform } from './khr-texture-transform.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_specular
const KHR_materials_specular = {
    apply(data, material, textures) {
        material.useMetalnessSpecularColor = true;

        if (data.hasOwnProperty('specularColorTexture')) {
            material.specularMap = textures[data.specularColorTexture.index];
            material.specularMapChannel = 'rgb';
            extractTextureTransform(data.specularColorTexture, material, ['specular']);
        }

        if (data.hasOwnProperty('specularColorFactor')) {
            const [r, g, b] = data.specularColorFactor;
            material.specular.set(r, g, b).gamma();
        } else {
            material.specular.set(1, 1, 1);
        }

        if (data.hasOwnProperty('specularFactor')) {
            material.specularityFactor = data.specularFactor;
        } else {
            material.specularityFactor = 1;
        }

        if (data.hasOwnProperty('specularTexture')) {
            material.specularityFactorMapChannel = 'a';
            material.specularityFactorMap = textures[data.specularTexture.index];
            extractTextureTransform(data.specularTexture, material, ['specularityFactor']);
        }
    },

    getColorTextures(data) {
        return data.hasOwnProperty('specularColorTexture') ? [data.specularColorTexture] : [];
    }
};

export { KHR_materials_specular };
