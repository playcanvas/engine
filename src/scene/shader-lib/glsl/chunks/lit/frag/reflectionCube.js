export default /* glsl */`
uniform samplerCube {LIT_ENV_CUBEMAP};
uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {
    vec3 lookupVec = cubeMapProject(reflDir);
    lookupVec.x *= -1.0;
    return {reflectionDecode}(textureCube({LIT_ENV_CUBEMAP}, lookupVec));
}

void addReflection(vec3 reflDir, float gloss) {   
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;
