export default /* glsl */`

uniform vec3 material_sheen;

void getSheen() {
    vec3 sheenColor = material_sheen;

    #ifdef MAPTEXTURE
    sheenColor *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    sheenColor *= saturate(vVertexColor.$VC);
    #endif

    sSpecularity = sheenColor;
}
`;
