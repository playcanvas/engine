export default /* glsl */`

uniform vec3 material_sheen;

void getSheen() {
    vec3 sheenColor = material_sheen;

    #ifdef STD_SHEEN_TEXTURE
    sheenColor *= {STD_SHEEN_TEXTURE_DECODE}(texture2DBias({STD_SHEEN_TEXTURE_NAME}, {STD_SHEEN_TEXTURE_UV}, textureBias)).{STD_SHEEN_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_SHEEN_VERTEX
    sheenColor *= saturate(vVertexColor.{STD_SHEEN_VERTEX_CHANNEL});
    #endif

    sSpecularity = sheenColor;
}
`;
