#ifndef PMREM128
#define PMREM128
uniform samplerCube texture_prefilteredCubeMap128;
#endif
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    float bias = saturate(1.0 - tGlossiness) * 5.0; // multiply by max mip level
    vec3 fixedReflDir = fixSeams(cubeMapProject(tReflDirW), bias);
#ifndef RIGHT_HANDED_CUBEMAP
    fixedReflDir.x *= -1.0;
#endif
    vec3 refl = processEnvironment($DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, bias) ).rgb);

    return refl;
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
