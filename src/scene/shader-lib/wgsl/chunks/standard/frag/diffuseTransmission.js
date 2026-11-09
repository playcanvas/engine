export default /* wgsl */`
uniform material_diffuseTransmission: f32;

fn getDiffuseTransmission() {
    var diffuseTransmission: f32 = uniform.material_diffuseTransmission;

    #ifdef STD_DIFFUSETRANSMISSION_TEXTURE
    diffuseTransmission = diffuseTransmission * textureSampleBias({STD_DIFFUSETRANSMISSION_TEXTURE_NAME}, {STD_DIFFUSETRANSMISSION_TEXTURE_NAME}Sampler, {STD_DIFFUSETRANSMISSION_TEXTURE_UV}, {STD_TEXTURE_BIAS}).{STD_DIFFUSETRANSMISSION_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_DIFFUSETRANSMISSION_VERTEX
    diffuseTransmission = diffuseTransmission * saturate(vVertexColor.{STD_DIFFUSETRANSMISSION_VERTEX_CHANNEL});
    #endif

    dDiffuseTransmission = diffuseTransmission;
}
`;
