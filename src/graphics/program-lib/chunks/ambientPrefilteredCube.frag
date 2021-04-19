#ifndef PMREM4
#define PMREM4
uniform samplerCube texture_prefilteredCubeMap4;
#endif

void addAmbient() {
    RMEDP vec3 fixedReflDir = fixSeamsStatic(cubeMapRotate(dNormalW), 1.0 - 1.0 / 4.0);
#ifndef RIGHT_HANDED_CUBEMAP
    fixedReflDir.x *= -1.0;
#endif
    dDiffuseLight += processEnvironment($DECODE(textureCube(texture_prefilteredCubeMap4, fixedReflDir)).rgb);
}
