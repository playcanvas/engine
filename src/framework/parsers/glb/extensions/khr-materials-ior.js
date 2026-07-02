// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_ior
const KHR_materials_ior = {
    apply(data, material, textures) {
        if (data.hasOwnProperty('ior')) {
            material.refractionIndex = 1.0 / data.ior;
        }
    }
};

export { KHR_materials_ior };
