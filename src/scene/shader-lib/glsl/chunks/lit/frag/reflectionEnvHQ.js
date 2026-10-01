export default /* glsl */`
#ifndef ENV_ATLAS
    #define ENV_ATLAS
    uniform sampler2D {LIT_ENV_ATLAS};
#endif
uniform samplerCube {LIT_ENV_CUBEMAP};
uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {
    vec3 dir = cubeMapProject(reflDir) * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(dir);

    // calculate roughness level
    float level = saturate(1.0 - gloss) * 5.0;
    float ilevel = floor(level);
    float flevel = level - ilevel;

    vec3 sharp = {reflectionCubemapDecode}(textureCube({LIT_ENV_CUBEMAP}, dir));
    vec3 roughA = {reflectionDecode}(texture2D({LIT_ENV_ATLAS}, mapRoughnessUv(uv, ilevel)));
    vec3 roughB = {reflectionDecode}(texture2D({LIT_ENV_ATLAS}, mapRoughnessUv(uv, ilevel + 1.0)));

    return processEnvironment(mix(sharp, mix(roughA, roughB, flevel), min(level, 1.0)));
}

void addReflection(vec3 reflDir, float gloss) {   
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;
