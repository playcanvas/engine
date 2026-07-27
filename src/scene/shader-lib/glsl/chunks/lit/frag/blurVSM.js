export default /* glsl */`
varying vec2 vUv0;

uniform sampler2D source;
uniform vec2 pixelOffset;

#ifdef GAUSS
    uniform float weight[{SAMPLES}];
#endif

void main(void) {
    // all four channels are filtered, as VSM_32F (EVSM4) stores moments in all of them
    vec4 moments = vec4(0.0);
    vec2 uv = vUv0 - pixelOffset * (float({SAMPLES}) * 0.5);
    for (int i = 0; i < {SAMPLES}; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i));

        #ifdef GAUSS
            moments += c * weight[i];
        #else
            moments += c;
        #endif
    }

    #ifndef GAUSS
        moments *= 1.0 / float({SAMPLES});
    #endif

    gl_FragColor = moments;
}
`;
