
varying vec2 vUv0;
uniform sampler2D source;
uniform vec2 pixelOffset;

void main(void) {
    vec2 moments = vec2(0.0);
    vec2 uv = vUv0 - pixelOffset * (float(SAMPLES) * 0.5);
    for(int i=0; i<SAMPLES; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i));
        moments += c.xy;
    }
    moments /= float(SAMPLES);
    gl_FragColor = vec4(moments.x, moments.y, 0.0, 0.0);
}

