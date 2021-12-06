#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif
uniform float material_reflectivity;

vec2 mapRoughnessUv(vec2 uv, float t) {
    return mapUv(uv, vec4(0, 1.0 - t, t, t * 0.5));
}

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 dir = cubeMapProject(tReflDirW) * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(dir);

    float level = saturate(1.0 - tGlossiness) * 5.0;
    float ilevel = floor(level);
    vec3 linear0 = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, 1.0 / exp2(ilevel))));
    vec3 linear1 = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, 1.0 / exp2(ilevel + 1.0))));

    return processEnvironment(mix(linear0, linear1, level - ilevel));
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
