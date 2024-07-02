
precision mediump float;

varying vec2 vUv0;

uniform sampler2D uDiffuseMap;
uniform sampler2D uHeightMap;
uniform float uTime;

vec3 gammaCorrectOutput(vec3 color) {
    return pow(color + 0.0000001, vec3(1.0 / 2.2));
}

void main(void)
{
    float height = texture2D(uHeightMap, vUv0).r;
    vec4 linearColor = texture2D(uDiffuseMap, vUv0);
    if (height < uTime) {
        discard;
    }
    if (height < (uTime + uTime * 0.1)) {
        linearColor = vec4(1.0, 0.02, 0.0, 1.0);
    }
    gl_FragColor.rgb = gammaCorrectOutput(linearColor.rgb);
    gl_FragColor.a = 1.0;
}