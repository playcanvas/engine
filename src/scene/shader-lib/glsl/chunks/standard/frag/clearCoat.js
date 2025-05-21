export default /* glsl */`
#ifdef STD_CLEARCOAT_CONSTANT
uniform float material_clearCoat;
#endif

void getClearCoat() {
    ccSpecularity = 1.0;

    #ifdef STD_CLEARCOAT_CONSTANT
    ccSpecularity *= material_clearCoat;
    #endif

    #ifdef STD_CLEARCOAT_TEXTURE
    ccSpecularity *= texture2DBias({STD_CLEARCOAT_TEXTURE_NAME}, {STD_CLEARCOAT_TEXTURE_UV}, textureBias).{STD_CLEARCOAT_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_CLEARCOAT_VERTEX
    ccSpecularity *= saturate(vVertexColor.{STD_CLEARCOAT_VERTEX_CHANNEL});
    #endif
}
`;
