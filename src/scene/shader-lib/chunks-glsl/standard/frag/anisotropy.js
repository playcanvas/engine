export default /* glsl */`

#ifdef LIT_GGX_SPECULAR
    uniform float material_anisotropy;
    uniform vec2 material_anisotropyRotation;
#endif

void getAnisotropy() {
    dAnisotropy = 1.0;

    dAnisotropy *= material_anisotropy;
    dAnisotropyRotation = material_anisotropyRotation;

    #ifdef STD_ANISOTROPY_TEXTURE
    dAnisotropy *= texture2DBias({STD_ANISOTROPY_TEXTURE_NAME}, {STD_ANISOTROPY_TEXTURE_UV}, textureBias).{STD_ANISOTROPY_TEXTURE_CHANNEL};
    #endif
}
`;
