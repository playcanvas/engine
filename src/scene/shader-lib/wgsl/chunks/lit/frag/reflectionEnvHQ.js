export default /* wgsl */`
#ifndef ENV_ATLAS
    #define ENV_ATLAS
    var texture_envAtlas: texture_2d<f32>;
    var texture_envAtlasSampler: sampler;
#endif

var texture_cubeMap: texture_cube<f32>;
var texture_cubeMapSampler: sampler;
uniform material_reflectivity: f32;

fn calcReflection(reflDir: vec3f, gloss: f32) -> vec3f {
    let dir: vec3f = cubeMapProject(reflDir) * vec3f(-1.0, 1.0, 1.0);
    let uv: vec2f = toSphericalUv(dir);

    // calculate roughness level
    let level: f32 = saturate(1.0 - gloss) * 5.0;
    let ilevel: f32 = floor(level);
    let flevel: f32 = level - ilevel;

    let sharp: vec3f = {reflectionCubemapDecode}(textureSample(texture_cubeMap, texture_cubeMapSampler, dir));
    let roughA: vec3f = {reflectionDecode}(textureSample(texture_envAtlas, texture_envAtlasSampler, mapRoughnessUv(uv, ilevel)));
    let roughB: vec3f = {reflectionDecode}(textureSample(texture_envAtlas, texture_envAtlasSampler, mapRoughnessUv(uv, ilevel + 1.0)));

    return processEnvironment(mix(sharp, mix(roughA, roughB, flevel), min(level, 1.0)));
}

fn addReflection(reflDir: vec3f, gloss: f32) {
    dReflection = dReflection + vec4f(calcReflection(reflDir, gloss), uniform.material_reflectivity);
}
`;
