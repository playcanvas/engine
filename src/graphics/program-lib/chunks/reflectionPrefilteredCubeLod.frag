
#ifndef PMREM4
#define PMREM4
#extension GL_EXT_shader_texture_lod : enable
uniform samplerCube texture_prefilteredCubeMap128;
#endif
vec4 calcReflection(vec3 tReflDirW, float tGlossiness, float tmaterial_reflectivity) {
    float bias = saturate(1.0 - tGlossiness) * 5.0; // multiply by max mip level
    vec3 fixedReflDir = fixSeams(cubeMapProject(tReflDirW), bias);
    fixedReflDir.x *= -1.0;

    vec3 refl = processEnvironment($DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, bias) ).rgb);

    return vec4(refl, tmaterial_reflectivity);
}
