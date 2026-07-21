import { extractTextureTransform } from './khr-texture-transform.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_iridescence
const KHR_materials_iridescence = {
    apply(data, material, textures) {
        material.useIridescence = true;
        if (data.hasOwnProperty('iridescenceFactor')) {
            material.iridescence = data.iridescenceFactor;
        }
        if (data.hasOwnProperty('iridescenceTexture')) {
            material.iridescenceMapChannel = 'r';
            material.iridescenceMap = textures[data.iridescenceTexture.index];
            extractTextureTransform(data.iridescenceTexture, material, ['iridescence']);

        }
        if (data.hasOwnProperty('iridescenceIor')) {
            material.iridescenceRefractionIndex = data.iridescenceIor;
        }
        if (data.hasOwnProperty('iridescenceThicknessMinimum')) {
            material.iridescenceThicknessMin = data.iridescenceThicknessMinimum;
        }
        if (data.hasOwnProperty('iridescenceThicknessMaximum')) {
            material.iridescenceThicknessMax = data.iridescenceThicknessMaximum;
        }
        if (data.hasOwnProperty('iridescenceThicknessTexture')) {
            material.iridescenceThicknessMapChannel = 'g';
            material.iridescenceThicknessMap = textures[data.iridescenceThicknessTexture.index];
            extractTextureTransform(data.iridescenceThicknessTexture, material, ['iridescenceThickness']);
        }
    }
};

export { KHR_materials_iridescence };
