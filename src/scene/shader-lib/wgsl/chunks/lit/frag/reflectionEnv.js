export default /* wgsl */`
#ifndef ENV_ATLAS
#define ENV_ATLAS
    var texture_envAtlas: texture_2d<f32>;
    var texture_envAtlasSampler: sampler;
#endif
uniform material_reflectivity: f32;

// calculate mip level for shiny reflection given equirect coords uv.
fn shinyMipLevel(uv: vec2f) -> f32 {
    let dx: vec2f = dpdx(uv);
    let dy: vec2f = dpdy(uv);

    // calculate second dF at 180 degrees
    let uv2: vec2f = vec2f(fract(uv.x + 0.5), uv.y);
    let dx2: vec2f = dpdx(uv2);
    let dy2: vec2f = dpdy(uv2);

    // calculate min of both sets of dF to handle discontinuity at the azim edge
    let maxd: f32 = min(max(dot(dx, dx), dot(dy, dy)), max(dot(dx2, dx2), dot(dy2, dy2)));

    return clamp(0.5 * log2(maxd) - 1.0 + uniform.textureBias, 0.0, 5.0);
}

fn calcReflection(reflDir: vec3f, gloss: f32) -> vec3f {
    let dir: vec3f = cubeMapProject(reflDir) * vec3f(-1.0, 1.0, 1.0);
    let uv: vec2f = toSphericalUv(dir);

    // calculate roughness level
    let level: f32 = saturate(1.0 - gloss) * 5.0;
    let ilevel: f32 = floor(level);

    // accessing the shiny (top level) reflection - perform manual mipmap lookup
    let level2: f32 = shinyMipLevel(uv * atlasSize);
    let ilevel2: f32 = floor(level2);

    var uv0: vec2f;
    var uv1: vec2f;
    var weight: f32;
    if (ilevel == 0.0) {
        uv0 = mapShinyUv(uv, ilevel2);
        uv1 = mapShinyUv(uv, ilevel2 + 1.0);
        weight = level2 - ilevel2;
    } else {
        // accessing rough reflection - just sample the same part twice
        uv0 = mapRoughnessUv(uv, ilevel);
        uv1 = uv0;
        weight = 0.0;
    }

    let linearA: vec3f = {reflectionDecode}(textureSample(texture_envAtlas, texture_envAtlasSampler, uv0));
    let linearB: vec3f = {reflectionDecode}(textureSample(texture_envAtlas, texture_envAtlasSampler, uv1));
    let linear0: vec3f = mix(linearA, linearB, weight);
    let linear1: vec3f = {reflectionDecode}(textureSample(texture_envAtlas, texture_envAtlasSampler, mapRoughnessUv(uv, ilevel + 1.0)));

    return processEnvironment(mix(linear0, linear1, level - ilevel));
}

fn addReflection(reflDir: vec3f, gloss: f32) {
    dReflection = dReflection + vec4f(calcReflection(reflDir, gloss), uniform.material_reflectivity);
}
`;
