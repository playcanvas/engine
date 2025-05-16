export default /* glsl */`

#ifdef LIT_GGX_SPECULAR
    uniform float material_anisotropy;
    uniform vec2 material_anisotropyRotation;
#endif

void getAnisotropy() {
    dAnisotropy = material_anisotropy;
    dAnisotropyRotation = material_anisotropyRotation;

    #ifdef STD_ANISOTROPY_TEXTURE
    dAnisotropy *= texture2DBias({STD_ANISOTROPY_TEXTURE_NAME}, {STD_ANISOTROPY_TEXTURE_UV}, textureBias).b;

    vec2 anisotropyRotationFromTex = texture2D({STD_ANISOTROPY_TEXTURE_NAME}, {STD_ANISOTROPY_TEXTURE_UV}).rg * 2.0 - vec2(1.0);
    mat2 rotationMatrix = mat2(dAnisotropyRotation.x, dAnisotropyRotation.y, -dAnisotropyRotation.y, dAnisotropyRotation.x);
    dAnisotropyRotation = rotationMatrix * anisotropyRotationFromTex;
    #endif
    
    dAnisotropy = clamp(dAnisotropy, 0.0, 1.0);
}
`;
