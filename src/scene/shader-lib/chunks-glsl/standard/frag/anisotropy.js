export default /* glsl */`

#ifdef LIT_GGX_SPECULAR
    uniform float material_anisotropy;
#endif

void getAnisotropy() {
    dAnisotropy = material_anisotropy;

    #ifdef STD_ANISOTROPY_TEXTURE
    dAnisotropy *= texture2DBias({STD_ANISOTROPY_TEXTURE_NAME}, {STD_ANISOTROPY_TEXTURE_UV}, textureBias).{STD_ANISOTROPY_TEXTURE_CHANNEL};
    #endif
}
`;
