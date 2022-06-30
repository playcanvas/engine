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
    specularity *= texture2DSRGB(texture_specularMap, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    specularity *= saturate(vVertexColor.$VC); 
    #endif

    dSpecularity = specularity;
}
`;
