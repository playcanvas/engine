export default /* glsl */`
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

    return clamp(0.5 * log2(maxd) - 1.0 + textureBias, 0.0, 5.0);
}

vec3 calcReflection(vec3 reflDir, float gloss) {
    vec3 dir = cubeMapProject(reflDir) * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(dir);

    // roughness mip level based on material gloss
    float level = saturate(1.0 - gloss) * 5.0;

    // screen-space minification level - drives specular anti-aliasing
    float level2 = shinyMipLevel(uv * atlasSize);

    // the reflection must be at least as blurry as screen-space minification requires,
    // otherwise high-curvature / minified surfaces alias badly
    level = max(level, level2);

    float ilevel = floor(level);

    vec2 uv0, uv1;
    if (ilevel == 0.0) {
        // sharp reflection: blend the shiny (top mip) level into roughness level 1
        uv0 = mapShinyUv(uv, 0.0);
        uv1 = mapRoughnessUv(uv, 1.0);
    } else {
        // blurry reflection: blend two pre-convolved roughness levels
        uv0 = mapRoughnessUv(uv, ilevel);
        uv1 = mapRoughnessUv(uv, ilevel + 1.0);
    }

    vec3 linearA = {reflectionDecode}(texture2D(texture_envAtlas, uv0));
    vec3 linearB = {reflectionDecode}(texture2D(texture_envAtlas, uv1));
    return processEnvironment(mix(linearA, linearB, level - ilevel));
}

void addReflection(vec3 reflDir, float gloss) {   
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;
