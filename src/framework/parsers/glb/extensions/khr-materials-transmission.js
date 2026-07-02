import { BLEND_NORMAL } from '../../../../scene/constants.js';
import { extractTextureTransform } from './khr-texture-transform.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_transmission
const KHR_materials_transmission = {
    apply(data, material, textures) {
        material.blendType = BLEND_NORMAL;
        material.useDynamicRefraction = true;

        if (data.hasOwnProperty('transmissionFactor')) {
            material.refraction = data.transmissionFactor;
        }
        if (data.hasOwnProperty('transmissionTexture')) {
            material.refractionMapChannel = 'r';
            material.refractionMap = textures[data.transmissionTexture.index];
            extractTextureTransform(data.transmissionTexture, material, ['refraction']);
        }
    }
};

export { KHR_materials_transmission };
