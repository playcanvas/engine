export default /* glsl */`
varying vec3 vViewDir;

uniform samplerCube texture_cubeMap;

#ifdef SKYMESH

    varying vec3 vWorldPos;
    uniform mat3 cubeMapRotationMatrix;
    uniform vec3 projectedSkydomeCenter;

#endif

void main(void) {

    #ifdef SKYMESH

        // get vector from world space pos to tripod origin
        vec3 envDir = normalize(vWorldPos - projectedSkydomeCenter);
        vec3 dir = envDir * cubeMapRotationMatrix;

    #else

        vec3 dir = vViewDir;

    #endif

    dir.x *= -1.0;
    vec3 linear = SKYBOX_DECODE_FNC(textureCube(texture_cubeMap, dir));
    gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
}
`;
