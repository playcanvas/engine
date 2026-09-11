export default /* wgsl */`
var {LIT_ENV_CUBEMAP}: texture_cube<f32>;
var {LIT_ENV_CUBEMAP}Sampler: sampler;
uniform material_reflectivity: f32;

fn calcReflection(reflDir: vec3f, gloss: f32) -> vec3f {
    var lookupVec: vec3f = cubeMapProject(reflDir);
    lookupVec.x = lookupVec.x * -1.0;
    return {reflectionDecode}(textureSample({LIT_ENV_CUBEMAP}, {LIT_ENV_CUBEMAP}Sampler, lookupVec));
}

fn addReflection(reflDir: vec3f, gloss: f32) {
    dReflection = dReflection + vec4f(calcReflection(reflDir, gloss), uniform.material_reflectivity);
}
`;
