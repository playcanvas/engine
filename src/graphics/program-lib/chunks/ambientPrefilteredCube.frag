#ifndef PMREM4
#define PMREM4
uniform samplerCube texture_prefilteredCubeMap4;
#endif

void addAmbient() {
    vec3 fixedReflDir = fixSeamsStatic(cubeMapRotateNegX(dNormalW), 1.0 - 1.0 / 4.0);    
    dDiffuseLight += processEnvironment($DECODE(textureCube(texture_prefilteredCubeMap4, fixedReflDir)).rgb);
}
