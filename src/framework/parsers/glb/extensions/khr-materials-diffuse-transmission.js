import { extractTextureTransform } from './khr-texture-transform.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_diffuse_transmission
const KHR_materials_diffuse_transmission = {
    apply(data, material, textures) {
        if (data.hasOwnProperty('diffuseTransmissionFactor')) {
            material.diffuseTransmission = data.diffuseTransmissionFactor;
        }
        if (data.hasOwnProperty('diffuseTransmissionTexture')) {
            const texture = data.diffuseTransmissionTexture;
            material.diffuseTransmissionMap = textures[texture.index];
            material.diffuseTransmissionMapChannel = 'a';
            extractTextureTransform(texture, material, ['diffuseTransmission']);
        }
        if (data.hasOwnProperty('diffuseTransmissionColorFactor')) {
            const [r, g, b] = data.diffuseTransmissionColorFactor;
            material.diffuseTransmissionColor.set(r, g, b).gamma();
        }
        if (data.hasOwnProperty('diffuseTransmissionColorTexture')) {
            const texture = data.diffuseTransmissionColorTexture;
            material.diffuseTransmissionColorMap = textures[texture.index];
            extractTextureTransform(texture, material, ['diffuseTransmissionColor']);
        }
    },

    getColorTextures(data) {
        const texture = data.diffuseTransmissionColorTexture;
        return texture ? [texture] : [];
    }
};

export { KHR_materials_diffuse_transmission };
