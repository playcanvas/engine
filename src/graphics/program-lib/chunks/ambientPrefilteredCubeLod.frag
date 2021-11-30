#ifndef PMREM128
#define PMREM128
uniform samplerCube texture_prefilteredCubeMap128;
#endif

void addAmbient() {
    vec3 fixedReflDir = fixSeamsStatic(cubeMapRotate(dNormalW), 1.0 - 1.0 / 4.0);
    fixedReflDir.x *= -1.0;
    dDiffuseLight += processEnvironment($DECODE( textureCubeLodEXT(texture_prefilteredCubeMap128, fixedReflDir, 5.0) ).rgb);
}
