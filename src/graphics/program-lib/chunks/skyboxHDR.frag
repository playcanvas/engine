varying vec3 vViewDir;

uniform samplerCube texture_cubeMap;

void main(void) {
    vec3 dir=vViewDir;
#ifndef RIGHT_HANDED_CUBEMAP
    dir.x *= -1.0;
#endif
    vec3 color = processEnvironment($textureCubeSAMPLE(texture_cubeMap, fixSeamsStatic(dir, $FIXCONST)).rgb);
    color = toneMap(color);
    color = gammaCorrectOutput(color);
    gl_FragColor = vec4(color, 1.0);
}
