export default /* wgsl */`
#ifndef ENV_ATLAS
    #define ENV_ATLAS
    var {LIT_ENV_ATLAS}: texture_2d<f32>;
    var {LIT_ENV_ATLAS}Sampler: sampler;
#endif

var {LIT_ENV_CUBEMAP}: texture_cube<f32>;
var {LIT_ENV_CUBEMAP}Sampler: sampler;
uniform material_reflectivity: f32;

fn calcReflection(reflDir: vec3f, gloss: f32) -> vec3f {
    let dir: vec3f = cubeMapProject(reflDir) * vec3f(-1.0, 1.0, 1.0);
    let uv: vec2f = toSphericalUv(dir);

    // calculate roughness level
    let level: f32 = saturate(1.0 - gloss) * 5.0;
    let ilevel: f32 = floor(level);
    let flevel: f32 = level - ilevel;

    let sharp: vec3f = {reflectionCubemapDecode}(textureSample({LIT_ENV_CUBEMAP}, {LIT_ENV_CUBEMAP}Sampler, dir));
    let roughA: vec3f = {reflectionDecode}(textureSample({LIT_ENV_ATLAS}, {LIT_ENV_ATLAS}Sampler, mapRoughnessUv(uv, ilevel)));
    let roughB: vec3f = {reflectionDecode}(textureSample({LIT_ENV_ATLAS}, {LIT_ENV_ATLAS}Sampler, mapRoughnessUv(uv, ilevel + 1.0)));

    return processEnvironment(mix(sharp, mix(roughA, roughB, flevel), min(level, 1.0)));
}

fn addReflection(reflDir: vec3f, gloss: f32) {
    dReflection = dReflection + vec4f(calcReflection(reflDir, gloss), uniform.material_reflectivity);
}
`;
