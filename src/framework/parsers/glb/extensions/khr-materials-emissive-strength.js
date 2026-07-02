// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_emissive_strength
const KHR_materials_emissive_strength = {
    apply(data, material, textures) {
        if (data.hasOwnProperty('emissiveStrength')) {
            material.emissiveIntensity = data.emissiveStrength;
        }
    }
};

export { KHR_materials_emissive_strength };
