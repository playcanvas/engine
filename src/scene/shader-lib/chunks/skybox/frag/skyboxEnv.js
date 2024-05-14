export default /* glsl */`
varying vec3 vViewDir;

uniform sampler2D texture_envAtlas;
uniform float mipLevel;

void main(void) {
    vec3 dir = vViewDir * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(normalize(dir));

    vec3 linear = SKYBOX_DECODE_FNC(texture2D(texture_envAtlas, mapRoughnessUv(uv, mipLevel)));

    gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
}
`;
