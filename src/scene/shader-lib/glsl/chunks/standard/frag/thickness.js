export default /* glsl */`
#ifdef STD_THICKNESS_CONSTANT
uniform float material_thickness;
#endif

void getThickness() {
    dThickness = 1.0;

    #ifdef STD_THICKNESS_CONSTANT
    dThickness *= material_thickness;
    #endif

    #ifdef STD_THICKNESS_TEXTURE
    dThickness *= texture2DBias({STD_THICKNESS_TEXTURE_NAME}, {STD_THICKNESS_TEXTURE_UV}, textureBias).{STD_THICKNESS_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_THICKNESS_VERTEX
    dThickness *= saturate(vVertexColor.{STD_THICKNESS_VERTEX_CHANNEL});
    #endif
}
`;
