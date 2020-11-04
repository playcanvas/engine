#ifndef PMREM4
#define PMREM4
#extension GL_EXT_shader_texture_lod : enable
uniform samplerCube texture_prefilteredCubeMap128;
#endif

void addAmbient() {
#ifdef CUBEMAPROT
    vec3 fixedReflDir = fixSeamsStatic(dNormalW*cubeMapRotationMatrix, 1.0 - 1.0 / 4.0);
#else
    vec3 fixedReflDir = fixSeamsStatic(dNormalW, 1.0 - 1.0 / 4.0);
#endif    
    fixedReflDir.x *= -1.0;
    dDiffuseLight += processEnvironment($DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, 5.0) ).rgb);
}
