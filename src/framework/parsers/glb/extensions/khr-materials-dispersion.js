// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_dispersion
const KHR_materials_dispersion = {
    apply(data, material, textures) {
        if (data.hasOwnProperty('dispersion')) {
            material.dispersion = data.dispersion;
        }
    }
};

export { KHR_materials_dispersion };
