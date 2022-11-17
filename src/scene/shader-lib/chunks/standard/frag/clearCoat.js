export default /* glsl */`
#ifdef MAPFLOAT
uniform float material_clearCoat;
#endif

void getClearCoat() {
    ccSpecularity = 1.0;

    #ifdef MAPFLOAT
    ccSpecularity *= material_clearCoat;
    #endif

    #ifdef MAPTEXTURE
    ccSpecularity *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    ccSpecularity *= saturate(vVertexColor.$VC);
    #endif
}
`;
