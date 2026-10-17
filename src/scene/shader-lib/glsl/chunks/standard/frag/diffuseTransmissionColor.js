export default /* glsl */`
uniform vec3 material_diffuseTransmissionColor;

void getDiffuseTransmissionColor() {
    vec3 diffuseTransmissionColor = material_diffuseTransmissionColor;

    #ifdef STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE
    diffuseTransmissionColor *= {STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE_NAME}, {STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE_UV}, {STD_TEXTURE_BIAS})).{STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_DIFFUSETRANSMISSIONCOLOR_VERTEX
    diffuseTransmissionColor *= saturate(vVertexColor.{STD_DIFFUSETRANSMISSIONCOLOR_VERTEX_CHANNEL});
    #endif

    dDiffuseTransmissionColor = diffuseTransmissionColor;
}
`;
