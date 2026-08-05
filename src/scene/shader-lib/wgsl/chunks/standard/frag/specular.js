export default /* wgsl */`

#ifdef STD_SPECULAR_CONSTANT
    uniform material_specular: vec3f;
#endif

fn getSpecularity() {
    var specularColor = vec3f(1.0, 1.0, 1.0);

    #ifdef STD_SPECULAR_CONSTANT
    specularColor = specularColor * uniform.material_specular;
    #endif

    #ifdef STD_SPECULAR_TEXTURE
    specularColor = specularColor * {STD_SPECULAR_TEXTURE_DECODE}(textureSampleBias({STD_SPECULAR_TEXTURE_NAME}, {STD_SPECULAR_TEXTURE_NAME}Sampler, {STD_SPECULAR_TEXTURE_UV}, uniform.textureBias)).{STD_SPECULAR_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_SPECULAR_VERTEX
    specularColor = specularColor * saturate3(vVertexColor.{STD_SPECULAR_VERTEX_CHANNEL});
    #endif

    dSpecularity = specularColor;
}
`;
