export default /* glsl */`
varying vec3 vViewDir;

uniform vec3 view_position;
uniform samplerCube texture_cubeMap;

uniform float skyboxTripodHeight;
uniform float skyboxScale;

void main(void) {
    vec3 dir = normalize(vViewDir);

    vec3 color = processEnvironment($textureCubeSAMPLE(texture_cubeMap, fixSeamsStatic(dir * vec3(-1.0, 1.0, 1.0), $FIXCONST)).rgb);

    if (view_position.y > 0.0 && dir.y < 0.0) {
        vec3 groundIntersection = (view_position - dir * (view_position.y / dir.y)) * skyboxScale;
        vec3 tmp = normalize(groundIntersection - vec3(0, skyboxTripodHeight, 0));
        if (tmp.y < -0.5) {
            vec3 groundColor = processEnvironment($textureCubeSAMPLE(texture_cubeMap, fixSeamsStatic(tmp * vec3(-1.0, 1.0, 1.0), $FIXCONST)).rgb);
            color = mix(groundColor, color, (1.0 + tmp.y) * 2.0);
        }
    }

    color = toneMap(color);
    color = gammaCorrectOutput(color);
    gl_FragColor = vec4(color, 1.0);
}
`;
