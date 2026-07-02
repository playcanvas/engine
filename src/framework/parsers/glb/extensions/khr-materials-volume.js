import { BLEND_NORMAL } from '../../../../scene/constants.js';
import { extractTextureTransform } from './khr-texture-transform.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_volume
const KHR_materials_volume = {
    apply(data, material, textures) {
        material.blendType = BLEND_NORMAL;
        material.useDynamicRefraction = true;
        if (data.hasOwnProperty('thicknessFactor')) {
            material.thickness = data.thicknessFactor;
        }
        if (data.hasOwnProperty('thicknessTexture')) {
            material.thicknessMap = textures[data.thicknessTexture.index];
            material.thicknessMapChannel = 'g';
            extractTextureTransform(data.thicknessTexture, material, ['thickness']);
        }
        if (data.hasOwnProperty('attenuationDistance')) {
            material.attenuationDistance = data.attenuationDistance;
        }
        if (data.hasOwnProperty('attenuationColor')) {
            const [r, g, b] = data.attenuationColor;
            material.attenuation.set(r, g, b).gamma();
        }
    }
};

export { KHR_materials_volume };
