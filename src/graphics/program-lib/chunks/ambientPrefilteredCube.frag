#ifndef PMREM4
#define PMREM4
uniform samplerCube texture_prefilteredCubeMap4;
#endif

void addAmbient() {
#ifdef CUBEMAPROT
    vec3 fixedReflDir = fixSeamsStatic(dNormalW*cubeMapRotationMatrix, 1.0 - 1.0 / 4.0);
#else
    vec3 fixedReflDir = fixSeamsStatic(dNormalW, 1.0 - 1.0 / 4.0);
    fixedReflDir.x *= -1.0;
#endif    
    dDiffuseLight += processEnvironment($DECODE(textureCube(texture_prefilteredCubeMap4, fixedReflDir)).rgb);
}
