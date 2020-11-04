#ifndef PMREM4
#define PMREM4
uniform samplerCube texture_prefilteredCubeMap4;
#endif

void addAmbient() {
#ifdef CUBEMAPROT
    vec3 fixedReflDir = fixSeamsStatic(dNormalW*cubeMapRotationMatrix, 1.0 - 1.0 / 4.0);
#else
    vec3 fixedReflDir = fixSeamsStatic(dNormalW, 1.0 - 1.0 / 4.0);
#endif
    fixedReflDir.x *= -1.0;
    dDiffuseLight += processEnvironment($DECODE(textureCube(texture_prefilteredCubeMap4, fixedReflDir)).rgb);
}
