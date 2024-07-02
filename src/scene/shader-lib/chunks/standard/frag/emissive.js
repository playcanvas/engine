export default /* glsl */`
uniform vec3 material_emissive;
uniform float material_emissiveIntensity;

void getEmission() {
    dEmission = material_emissive * material_emissiveIntensity;

    #ifdef MAPTEXTURE
    dEmission *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    dEmission *= gammaCorrectInput(saturate(vVertexColor.$VC));
    #endif
}
`;
