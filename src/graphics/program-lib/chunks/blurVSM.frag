
varying vec2 vUv0;
uniform sampler2D source;
uniform vec2 pixelOffset;

#ifdef GAUSS
uniform float weight[SAMPLES];
#endif

#ifdef PACKED
float decodeFloatRG(vec2 rg) {
    return rg.y*(1.0/255.0) + rg.x;
}

vec2 encodeFloatRG( float v ) {
  vec2 enc = vec2(1.0, 255.0) * v;
  enc = fract(enc);
  enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);
  return enc;
}
#endif

void main(void) {
    vec3 moments = vec3(0.0);
    vec2 uv = vUv0 - pixelOffset * (float(SAMPLES) * 0.5);
    for(int i=0; i<SAMPLES; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i));

        #ifdef PACKED
        c.xy = vec2(decodeFloatRG(c.xy), decodeFloatRG(c.zw));
        #endif

        #ifdef GAUSS
        moments += c.xyz * weight[i];
        #else
        moments += c.xyz;
        #endif
    }

    #ifndef GAUSS
    moments /= float(SAMPLES);
    #endif

    #ifdef PACKED
    gl_FragColor = vec4(encodeFloatRG(moments.x), encodeFloatRG(moments.y));
    #else
    gl_FragColor = vec4(moments.x, moments.y, moments.z, 1.0);
    #endif
}

