export default /* glsl */`
uniform float material_aoIntensity;

#ifdef MAPSSAO
    uniform sampler2D ssaoTexture;
#endif

void getAO() {
    dAo = 1.0;

    #ifdef MAPSSAO
    vec2 ssaoTextureSize = vec2(textureSize(ssaoTexture, 0));
    dAo *= texture2DLodEXT(ssaoTexture, gl_FragCoord.xy / ssaoTextureSize, 0.0).r;
    #endif

    #ifdef MAPTEXTURE
    float aoBase = texture2DBias($SAMPLER, $UV, textureBias).$CH;
    dAo *= addAoDetail(aoBase);
    #endif

    #ifdef MAPVERTEX
    dAo *= saturate(vVertexColor.$VC);
    #endif

    dAo = mix(1.0, dAo, material_aoIntensity);
}
`;
