export default /* wgsl */`
uniform material_diffuseTransmissionColor: vec3f;

fn getDiffuseTransmissionColor() {
    var diffuseTransmissionColor: vec3f = uniform.material_diffuseTransmissionColor;

    #ifdef STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE
    diffuseTransmissionColor = diffuseTransmissionColor * {STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE_DECODE}(textureSampleBias({STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE_NAME}, {STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE_NAME}Sampler, {STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE_UV}, {STD_TEXTURE_BIAS})).{STD_DIFFUSETRANSMISSIONCOLOR_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_DIFFUSETRANSMISSIONCOLOR_VERTEX
    diffuseTransmissionColor = diffuseTransmissionColor * saturate3(vVertexColor.{STD_DIFFUSETRANSMISSIONCOLOR_VERTEX_CHANNEL});
    #endif

    dDiffuseTransmissionColor = diffuseTransmissionColor;
}
`;
