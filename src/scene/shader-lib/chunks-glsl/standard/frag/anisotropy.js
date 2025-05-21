export default /* glsl */`

#ifdef LIT_GGX_SPECULAR
    uniform float material_anisotropyIntensity;
    uniform vec2 material_anisotropyRotation;
#endif

void getAnisotropy() {
    dAnisotropy = 0.0;
    dAnisotropyRotation = vec2(1.0,0.0);

#ifdef LIT_GGX_SPECULAR
    dAnisotropy = material_anisotropyIntensity;
    dAnisotropyRotation = material_anisotropyRotation;
#endif

    #ifdef STD_ANISOTROPY_TEXTURE
    vec3 anisotropyTex = texture2DBias({STD_ANISOTROPY_TEXTURE_NAME}, {STD_ANISOTROPY_TEXTURE_UV}, textureBias).rgb;
    dAnisotropy *= anisotropyTex.b;

    vec2 anisotropyRotationFromTex = anisotropyTex.rg * 2.0 - vec2(1.0);
    mat2 rotationMatrix = mat2(dAnisotropyRotation.x, dAnisotropyRotation.y, -dAnisotropyRotation.y, dAnisotropyRotation.x);
    dAnisotropyRotation = rotationMatrix * anisotropyRotationFromTex;
    #endif
    
    dAnisotropy = clamp(dAnisotropy, 0.0, 1.0);
}
`;
