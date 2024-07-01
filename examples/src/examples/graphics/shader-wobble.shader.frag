
precision mediump float;

uniform sampler2D uDiffuseMap;

varying vec2 vUv0;

vec3 gammaCorrectOutput(vec3 color) {
    return pow(color + 0.0000001, vec3(1.0 / 2.2));
}

void main(void)
{
    vec4 linearColor = texture2D(uDiffuseMap, vUv0);
    gl_FragColor.rgb = gammaCorrectOutput(linearColor.rgb);
    gl_FragColor.a = 1.0;
}