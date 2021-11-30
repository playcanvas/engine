uniform samplerCube texture_envAmbient;

void addAmbient() {
    vec3 dir = cubeMapRotate(dNormalW);

#ifndef RIGHT_HANDED_CUBEMAP
    dir.x *= -1.0;
#endif

    // fix seams
    dir = fixSeamsStatic(dir, 1.0 - 1.0 / 16.0);

    vec4 raw = textureCube(texture_envAmbient, dir);
    vec3 linear = $DECODE(raw);
    dDiffuseLight += processEnvironment(linear);
}
