// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_unlit
const KHR_materials_unlit = {
    apply(data, material, textures) {
        material.useLighting = false;

        // copy diffuse into emissive
        material.emissive.copy(material.diffuse);
        material.emissiveMap = material.diffuseMap;
        material.emissiveMapUv = material.diffuseMapUv;
        material.emissiveMapTiling.copy(material.diffuseMapTiling);
        material.emissiveMapOffset.copy(material.diffuseMapOffset);
        material.emissiveMapRotation = material.diffuseMapRotation;
        material.emissiveMapChannel = material.diffuseMapChannel;
        material.emissiveVertexColor = material.diffuseVertexColor;
        material.emissiveVertexColorChannel = material.diffuseVertexColorChannel;

        // disable lighting and skybox
        material.useLighting = false;
        material.useSkybox = false;

        // blank diffuse
        material.diffuse.set(1, 1, 1);
        material.diffuseMap = null;
        material.diffuseVertexColor = false;
    }
};

export { KHR_materials_unlit };
