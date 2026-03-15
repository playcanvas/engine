export default /* wgsl */`
uniform material_emissive: vec3f;
uniform material_emissiveIntensity: f32;

fn getEmission() {
    dEmission = uniform.material_emissive * uniform.material_emissiveIntensity;

    #ifdef STD_EMISSIVE_TEXTURE
    dEmission *= {STD_EMISSIVE_TEXTURE_DECODE}(textureSampleBias({STD_EMISSIVE_TEXTURE_NAME}, {STD_EMISSIVE_TEXTURE_NAME}Sampler, {STD_EMISSIVE_TEXTURE_UV}, uniform.textureBias)).{STD_EMISSIVE_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_EMISSIVE_VERTEX
    dEmission = dEmission * saturate3(vVertexColor.{STD_EMISSIVE_VERTEX_CHANNEL});
    #endif
}
`;
