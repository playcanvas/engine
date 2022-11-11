export default /* glsl */`

#ifdef MAPCOLOR
uniform vec3 material_sheen;
#endif

void getSheen() {
    vec3 sheenColor = vec3(1, 1, 1);

    #ifdef MAPCOLOR
    sheenColor *= material_sheen;
    #endif

    #ifdef MAPTEXTURE
    sheenColor *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    sheenColor *= saturate(vVertexColor.$VC);
    #endif

    sSpecularity = sheenColor;
}
`;
