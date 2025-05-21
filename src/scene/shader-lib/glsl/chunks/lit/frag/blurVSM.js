export default /* glsl */`
varying vec2 vUv0;

uniform sampler2D source;
uniform vec2 pixelOffset;

#ifdef GAUSS
    uniform float weight[{SAMPLES}];
#endif

void main(void) {
    vec3 moments = vec3(0.0);
    vec2 uv = vUv0 - pixelOffset * (float({SAMPLES}) * 0.5);
    for (int i = 0; i < {SAMPLES}; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i));

        #ifdef GAUSS
            moments += c.xyz * weight[i];
        #else
            moments += c.xyz;
        #endif
    }

    #ifndef GAUSS
        moments *= 1.0 / float({SAMPLES});
    #endif

    gl_FragColor = vec4(moments.x, moments.y, moments.z, 1.0);
}
`;
