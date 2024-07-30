export default /* glsl */`
uniform float material_ao;

void getAO() {
    dAo = 1.0;

    #ifdef MAPTEXTURE
    float aoBase = texture2DBias($SAMPLER, $UV, textureBias).$CH;
    dAo *= addAoDetail(aoBase);
    #endif

    #ifdef MAPVERTEX
    dAo *= saturate(vVertexColor.$VC);
    #endif

    dAo = mix(1.0, dAo, material_ao);
}
`;
