#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 dir = cubeMapProject(tReflDirW) * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(dir);

    float level = saturate(1.0 - tGlossiness) * 5.0;
    float ilevel = floor(level);
    vec3 linear0 = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel)));
    vec3 linear1 = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel + 1.0)));

    return processEnvironment(mix(linear0, linear1, level - ilevel));
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
