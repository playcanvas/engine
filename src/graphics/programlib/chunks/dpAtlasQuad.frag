varying vec2 vUv0;
uniform sampler2D source;
uniform vec4 params;

void main(void) {
    vec2 uv = vUv0;
    uv = uv * 2.0 - vec2(1.0);
    uv *= params.xy;
    uv = uv * 0.5 + 0.5;
    gl_FragColor = texture2D(source, uv);
}
