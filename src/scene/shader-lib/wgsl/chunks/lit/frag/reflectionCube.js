export default /* wgsl */`
var texture_cubeMap: texture_cube<f32>;
var texture_cubeMapSampler: sampler;
uniform material_reflectivity: f32;

fn calcReflection(reflDir: vec3f, gloss: f32) -> vec3f {
    var lookupVec: vec3f = cubeMapProject(reflDir);
    lookupVec.x = lookupVec.x * -1.0;
    return {reflectionDecode}(textureSample(texture_cubeMap, texture_cubeMapSampler, lookupVec));
}

fn addReflection(reflDir: vec3f, gloss: f32) {
    dReflection = dReflection + vec4f(calcReflection(reflDir, gloss), uniform.material_reflectivity);
}
`;
