#ifndef PMREM4
#define PMREM4
#extension GL_EXT_shader_texture_lod : enable
uniform samplerCube texture_prefilteredCubeMap128;
#endif
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    RMEDP float bias = saturate(1.0 - tGlossiness) * 5.0; // multiply by max mip level
    RMEDP vec3 fixedReflDir = fixSeams(cubeMapProject(tReflDirW), bias);
#ifndef RIGHT_HANDED_CUBEMAP
    fixedReflDir.x *= -1.0;
#endif
    RMEDP vec3 refl = processEnvironment($DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, bias) ).rgb);

    return refl;
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
