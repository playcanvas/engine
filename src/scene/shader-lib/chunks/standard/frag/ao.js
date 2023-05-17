export default /* glsl */`

void getAO() {
    dAo = 1.0;

    #ifdef MAPTEXTURE
    float aoBase = texture2DBias($SAMPLER, $UV, textureBias).$CH;
    dAo *= addAoDetail(aoBase);
    #endif

    #ifdef MAPVERTEX
    dAo *= saturate(vVertexColor.$VC);
    #endif
}
`;
