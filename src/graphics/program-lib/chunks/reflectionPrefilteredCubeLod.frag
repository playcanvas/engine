
#ifndef PMREM4
#define PMREM4
#extension GL_EXT_shader_texture_lod : enable
uniform samplerCube texture_prefilteredCubeMap128;
#endif
uniform float material_reflectivity;

void addReflection() {

    float bias = saturate(1.0 - dGlossiness) * 5.0; // multiply by max mip level
    vec3 fixedReflDir = fixSeams(cubeMapProject(dReflDirW), bias);
    fixedReflDir.x *= -1.0;

    vec3 refl = processEnvironment($DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, bias) ).rgb);

    dReflection += vec4(refl, material_reflectivity);
}

