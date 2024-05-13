export default /* glsl */`
uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {
    vec3 lookupVec = cubeMapProject(reflDir);
    lookupVec.x *= -1.0;
    return $DECODE(textureCube(texture_cubeMap, lookupVec));
}

void addReflection(vec3 reflDir, float gloss) {   
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;
