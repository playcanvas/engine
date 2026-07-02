// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_variants

// returns a map of variant names to their index, or null when the file has no variants
const createVariants = (gltf) => {
    if (!gltf.hasOwnProperty('extensions') || !gltf.extensions.hasOwnProperty('KHR_materials_variants')) {
        return null;
    }

    const data = gltf.extensions.KHR_materials_variants.variants;
    const variants = {};
    for (let i = 0; i < data.length; i++) {
        variants[data[i].name] = i;
    }
    return variants;
};

// stores the primitive's variant index to material index mapping under the mesh id
const registerMeshVariants = (primitive, meshId, meshVariants) => {
    if (primitive?.extensions?.KHR_materials_variants) {
        const variants = primitive.extensions.KHR_materials_variants;
        const tempMapping = {};
        variants.mappings.forEach((mapping) => {
            mapping.variants.forEach((variant) => {
                tempMapping[variant] = mapping.material;
            });
        });
        meshVariants[meshId] = tempMapping;
    }
};

export { createVariants, registerMeshVariants };
