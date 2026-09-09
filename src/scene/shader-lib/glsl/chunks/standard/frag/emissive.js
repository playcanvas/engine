export default /* glsl */`
#ifndef MESH_COLOR
    uniform vec3 material_emissive;
#endif
uniform float material_emissiveIntensity;

void getEmission() {
    #ifdef MESH_COLOR
        dEmission = mesh_color.rgb * material_emissiveIntensity;
    #else
        dEmission = material_emissive * material_emissiveIntensity;
    #endif

    #ifdef STD_EMISSIVE_TEXTURE
    dEmission *= {STD_EMISSIVE_TEXTURE_DECODE}(texture2DBias({STD_EMISSIVE_TEXTURE_NAME}, {STD_EMISSIVE_TEXTURE_UV}, textureBias)).{STD_EMISSIVE_TEXTURE_CHANNEL};
    #endif

    #ifdef STD_EMISSIVE_VERTEX
    dEmission *= saturate(vVertexColor.{STD_EMISSIVE_VERTEX_CHANNEL});
    #endif
}
`;
