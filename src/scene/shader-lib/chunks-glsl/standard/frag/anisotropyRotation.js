export default /* glsl */`
#ifdef LIT_GGX_SPECULAR
    uniform vec2 material_anisotropyRotation;
#endif

void getAnisotropyRotation() {
    dAnisotropyRotation = material_anisotropyRotation;

    #ifdef STD_ANISOTROPYROTATION_TEXTURE
    dAnisotropyRotation = texture2D({STD_ANISOTROPYROTATION_TEXTURE_NAME}, {STD_ANISOTROPYROTATION_TEXTURE_UV}).{STD_ANISOTROPYROTATION_TEXTURE_CHANNEL} * 2.0 - vec2(1.0);
    dAnisotropyRotation = mat2(dAnisotropyRotation.x, dAnisotropyRotation.y, -dAnisotropyRotation.y, dAnisotropyRotation.x) * normalize(dAnisotropyRotation);
    #endif
}
`;
