#ifndef PMREM4
#define PMREM4
#extension GL_EXT_shader_texture_lod : enable
uniform samplerCube texture_prefilteredCubeMap128;
#endif
void addAmbient() {
    vec3 fixedReflDir = fixSeamsStatic(dNormalW, 1.0 - 1.0 / 4.0);
    fixedReflDir.x *= -1.0;
    dDiffuseLight += processEnvironment($DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, 5.0) ).rgb);
}

