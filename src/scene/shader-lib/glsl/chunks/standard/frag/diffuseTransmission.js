export default /* glsl */`
uniform float material_diffuseTransmission;

void getDiffuseTransmission() {
    float diffuseTransmission = material_diffuseTransmission;

    #ifdef STD_DIFFUSETRANSMISSION_TEXTURE
    diffuseTransmission *= texture2DBias({STD_DIFFUSETRANSMISSION_TEXTURE_NAME}, {STD_DIFFUSETRANSMISSION_TEXTURE_UV}, {STD_TEXTURE_BIAS}).{STD_DIFFUSETRANSMISSION_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_DIFFUSETRANSMISSION_VERTEX
    diffuseTransmission *= saturate(vVertexColor.{STD_DIFFUSETRANSMISSION_VERTEX_CHANNEL});
    #endif

    dDiffuseTransmission = diffuseTransmission;
}
`;
