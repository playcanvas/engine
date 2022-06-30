export default /* glsl */`
#ifdef MAPCOLOR
uniform vec3 material_specular;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_specularMap;
#endif

void getSpecularity() {

    vec3 specularity = vec3(1, 1, 1);

    #ifdef MAPCOLOR
    specularity *= material_specular;
    #endif

    #ifdef MAPTEXTURE
    vec3 srgb = texture2D(texture_specularMap, $UV, textureBias).$CH;
    specularity *=  vec3(pow(srgb.r, 2.2), pow(srgb.g, 2.2), pow(srgb.b, 2.2));
    #endif

    #ifdef MAPVERTEX
    specularity *= saturate(vVertexColor.$VC); 
    #endif

    dSpecularity = specularity;
}
`;
