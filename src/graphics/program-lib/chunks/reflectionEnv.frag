#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif
uniform float material_reflectivity;

// calculate mip level for shiny reflection given equirect coords uv.
float shinyMipLevel(vec2 uv) {
    vec2 dx = dFdx(uv);
    vec2 dy = dFdy(uv);

    // calculate second dF at 180 degrees
    vec2 uv2 = vec2(fract(uv.x + 0.5), uv.y);
    vec2 dx2 = dFdx(uv2);
    vec2 dy2 = dFdy(uv2);

    // calculate min of both sets of dF to handle discontinuity at the azim edge
    float maxd = min(max(dot(dx, dx), dot(dy, dy)), max(dot(dx2, dx2), dot(dy2, dy2)));

    return clamp(0.5 * log2(maxd), 0.0, 10.0);
}

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 dir = cubeMapProject(tReflDirW) * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(dir);

    float level = saturate(1.0 - tGlossiness) * 5.0;
    float ilevel = floor(level);

    vec3 linear0;
    if (ilevel == 0.0) {
        float level2 = shinyMipLevel(uv * atlasSize);
        float ilevel2 = floor(level2);
        vec3 linearA = $DECODE(texture2D(texture_envAtlas, mapMip(uv, ilevel2)));
        vec3 linearB = $DECODE(texture2D(texture_envAtlas, mapMip(uv, ilevel2 + 1.0)));
        linear0 = mix(linearA, linearB, level2 - ilevel2);
    } else {
        linear0 = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel)));
    }
    vec3 linear1 = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel + 1.0)));

    return processEnvironment(mix(linear0, linear1, level - ilevel));
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
