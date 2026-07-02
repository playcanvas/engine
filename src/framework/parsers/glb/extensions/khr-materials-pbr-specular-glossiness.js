import { extractTextureTransform } from './khr-texture-transform.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Archived/KHR_materials_pbrSpecularGlossiness
const KHR_materials_pbrSpecularGlossiness = {
    apply(data, material, textures) {
        let texture;
        if (data.hasOwnProperty('diffuseFactor')) {
            const [r, g, b, a] = data.diffuseFactor;
            material.diffuse.set(r, g, b).gamma();
            material.opacity = a;
        } else {
            material.diffuse.set(1, 1, 1);
            material.opacity = 1;
        }
        if (data.hasOwnProperty('diffuseTexture')) {
            const diffuseTexture = data.diffuseTexture;
            texture = textures[diffuseTexture.index];

            material.diffuseMap = texture;
            material.diffuseMapChannel = 'rgb';
            material.opacityMap = texture;
            material.opacityMapChannel = 'a';

            extractTextureTransform(diffuseTexture, material, ['diffuse', 'opacity']);
        }
        material.useMetalness = false;
        if (data.hasOwnProperty('specularFactor')) {
            const [r, g, b] = data.specularFactor;
            material.specular.set(r, g, b).gamma();
        } else {
            material.specular.set(1, 1, 1);
        }
        if (data.hasOwnProperty('glossinessFactor')) {
            material.gloss = data.glossinessFactor;
        } else {
            material.gloss = 1.0;
        }
        if (data.hasOwnProperty('specularGlossinessTexture')) {
            const specularGlossinessTexture = data.specularGlossinessTexture;
            material.specularMap = material.glossMap = textures[specularGlossinessTexture.index];
            material.specularMapChannel = 'rgb';
            material.glossMapChannel = 'a';

            extractTextureTransform(specularGlossinessTexture, material, ['gloss', 'metalness']);
        }
    },

    getColorTextures(data) {
        return data.hasOwnProperty('specularGlossinessTexture') ? [data.specularGlossinessTexture] : [];
    }
};

export { KHR_materials_pbrSpecularGlossiness };
