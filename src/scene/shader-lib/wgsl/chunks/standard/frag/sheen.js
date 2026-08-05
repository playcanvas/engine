export default /* wgsl */`

uniform material_sheen: vec3f;

fn getSheen() {
    var sheenColor = uniform.material_sheen;

    #ifdef STD_SHEEN_TEXTURE
    sheenColor = sheenColor * {STD_SHEEN_TEXTURE_DECODE}(textureSampleBias({STD_SHEEN_TEXTURE_NAME}, {STD_SHEEN_TEXTURE_NAME}Sampler, {STD_SHEEN_TEXTURE_UV}, uniform.textureBias)).{STD_SHEEN_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_SHEEN_VERTEX
    sheenColor = sheenColor * saturate3(vVertexColor.{STD_SHEEN_VERTEX_CHANNEL});
    #endif

    sSpecularity = sheenColor;
}
`;
