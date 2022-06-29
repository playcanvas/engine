export default /* glsl */`

#ifdef MAPCOLOR
uniform vec3 material_f0;
#endif

#ifdef MAPTEXTURE
uniform sampler2D texture_f0Map;
#endif

vec3 getF0() {
    vec3 f0 = vec3(1,1,1);

    #ifdef MAPCOLOR
    f0 *= material_f0;
    #endif

    #ifdef MAPTEXTURE
    f0 *= texture2D(texture_f0Map, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    f0 *= saturate(vVertexColor.$VC);
    #endif

    return f0;
}
`;
