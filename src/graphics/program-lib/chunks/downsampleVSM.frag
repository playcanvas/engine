varying vec2 vUv0;
uniform sampler2D source;
uniform vec2 pixelOffset;

float decodeFloatRG(vec2 rg) {
    return rg.y*(1.0/255.0) + rg.x;
}

vec2 encodeFloatRG( float v ) {
  vec2 enc = vec2(1.0, 255.0) * v;
  enc = fract(enc);
  enc -= enc.yy * vec2(1.0/255.0, 1.0/255.0);
  return enc;
}

float saturate(float f) {
    return clamp(f, 0.0, 1.0);
}

void main(void) {
    vec2 moments = vec2(0.0);

    // AESM
    //moments.y = 1000.0;
    moments.y = decodeFloatRG(texture2D(source, vUv0).zw); // force compiler to not be dumb

    for(int y=-1; y<=1; y++) {
        for(int x=-1; x<=1; x++) {
            vec4 c = texture2D(source, vUv0 + pixelOffset * vec2(x,y));
            moments.x += decodeFloatRG(c.xy);
            moments.y = min(moments.y, decodeFloatRG(c.zw));
            //moments.y += decodeFloatRG(c.zw);
        }
    }

    moments.x /= 9.0;

    //moments.y /= 9.0;

    /*vec4 c00 = texture2D(source, vUv0);
    vec4 c10 = texture2D(source, vUv0 + vec2(pixelOffset.x,0));
    vec4 c01 = texture2D(source, vUv0 + vec2(0,pixelOffset.y));
    vec4 c11 = texture2D(source, vUv0 + pixelOffset);
    moments.x = decodeFloatRG(c00.xy);
    moments.y = min(decodeFloatRG(c00.zw), decodeFloatRG(c10.zw));
    moments.y = min(moments.y, decodeFloatRG(c01.zw));
    moments.y = min(moments.y, decodeFloatRG(c11.zw));*/

    gl_FragColor = vec4(encodeFloatRG(moments.x), encodeFloatRG(moments.y));
}

