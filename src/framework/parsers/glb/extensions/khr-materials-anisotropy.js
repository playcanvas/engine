import { math } from '../../../../core/math/math.js';
import { extractTextureTransform } from './khr-texture-transform.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_anisotropy
const KHR_materials_anisotropy = {
    apply(data, material, textures) {
        material.enableGGXSpecular = true;

        if (data.hasOwnProperty('anisotropyStrength')) {
            material.anisotropyIntensity = data.anisotropyStrength;
        } else {
            material.anisotropyIntensity = 0;
        }
        if (data.hasOwnProperty('anisotropyTexture')) {
            const anisotropyTexture = data.anisotropyTexture;
            material.anisotropyMap = textures[anisotropyTexture.index];

            extractTextureTransform(anisotropyTexture, material, ['anisotropy']);
        }
        if (data.hasOwnProperty('anisotropyRotation')) {
            material.anisotropyRotation = data.anisotropyRotation * math.RAD_TO_DEG;
        } else {
            material.anisotropyRotation = 0;
        }
    }
};

export { KHR_materials_anisotropy };
