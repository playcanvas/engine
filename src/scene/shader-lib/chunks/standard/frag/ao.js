export default /* glsl */`

#ifdef MAPTEXTURE
    #define AO_INTENSITY
#endif

#ifdef MAPVERTEX
    #define AO_INTENSITY
#endif

#ifdef AO_INTENSITY
    uniform float material_aoIntensity;
#endif

void getAO() {
    dAo = 1.0;

    #ifdef MAPTEXTURE
        float aoBase = texture2DBias($SAMPLER, $UV, textureBias).$CH;
        dAo *= addAoDetail(aoBase);
    #endif

    #ifdef MAPVERTEX
        dAo *= saturate(vVertexColor.$VC);
    #endif

    #ifdef AO_INTENSITY
        dAo = mix(1.0, dAo, material_aoIntensity);
    #endif
}
`;
