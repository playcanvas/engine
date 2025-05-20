export default /* wgsl */`

#ifdef LIT_GGX_SPECULAR
    uniform material_anisotropyIntensity: f32;
    uniform material_anisotropyRotation: vec2f;
#endif

fn getAnisotropy() {
    dAnisotropy = 0.0;
    dAnisotropyRotation = vec2f(1.0, 0.0);

#ifdef LIT_GGX_SPECULAR
    dAnisotropy = material_anisotropyIntensity;
    dAnisotropyRotation = material_anisotropyRotation;
#endif

#ifdef STD_ANISOTROPY_TEXTURE
    dAnisotropy *= texture2DBias({STD_ANISOTROPY_TEXTURE_NAME}, {STD_ANISOTROPY_TEXTURE_NAME}Sampler, {STD_ANISOTROPY_TEXTURE_UV}, textureBias).b;

    let anisotropyRotationFromTex: vec2f = texture2DBias({STD_ANISOTROPY_TEXTURE_NAME}, {STD_ANISOTROPY_TEXTURE_NAME}Sampler, {STD_ANISOTROPY_TEXTURE_UV}, textureBias).rg * 2.0 - vec2f(1.0);
    mat2 rotationMatrix: mat2x2f = mat2x2f(dAnisotropyRotation.x, dAnisotropyRotation.y, -dAnisotropyRotation.y, dAnisotropyRotation.x);
    dAnisotropyRotation = rotationMatrix * anisotropyRotationFromTex;
#endif

    dAnisotropy = clamp(dAnisotropy, 0.0, 1.0);
}
`;
