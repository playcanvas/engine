export default /* glsl */`
uniform float material_opacity;

void getOpacity() {
    dAlpha = material_opacity;

    #ifdef STD_OPACITY_TEXTURE
    dAlpha *= texture2DBias({STD_OPACITY_TEXTURE_NAME}, {STD_OPACITY_TEXTURE_UV}, textureBias).{STD_OPACITY_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_OPACITY_VERTEX
    dAlpha *= clamp(vVertexColor.{STD_OPACITY_VERTEX_CHANNEL}, 0.0, 1.0);
    #endif
}
`;
