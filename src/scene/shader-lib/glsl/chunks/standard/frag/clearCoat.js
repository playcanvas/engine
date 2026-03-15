export default /* glsl */`
uniform float material_clearCoat;

void getClearCoat() {
    ccSpecularity = material_clearCoat;

    #ifdef STD_CLEARCOAT_TEXTURE
    ccSpecularity *= texture2DBias({STD_CLEARCOAT_TEXTURE_NAME}, {STD_CLEARCOAT_TEXTURE_UV}, textureBias).{STD_CLEARCOAT_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_CLEARCOAT_VERTEX
    ccSpecularity *= saturate(vVertexColor.{STD_CLEARCOAT_VERTEX_CHANNEL});
    #endif
}
`;
