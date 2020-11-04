varying vec3 vViewDir;

uniform samplerCube texture_cubeMap;
uniform mat3 cubeMapRotationMatrix;

void main(void) {
    vec3 color = processEnvironment($textureCubeSAMPLE(texture_cubeMap, fixSeamsStatic(((vViewDir*vec3(-1,1,1))*cubeMapRotationMatrix)*vec3(-1,1,1), $FIXCONST)).rgb);
    color = toneMap(color);
    color = gammaCorrectOutput(color);
    gl_FragColor = vec4(color, 1.0);
}
