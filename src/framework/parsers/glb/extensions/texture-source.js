// Resolves the image index of a glTF texture, taking the compressed texture source extensions
// into account:
// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_texture_basisu
// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_texture_webp
const getTextureSource = gltfTexture => gltfTexture.extensions?.KHR_texture_basisu?.source ??
    gltfTexture.extensions?.EXT_texture_webp?.source ??
    gltfTexture.source;

export { getTextureSource };
