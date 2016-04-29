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

void main(void) {
    vec2 moments = vec2(0.0);

    /*for(int y=-2; y<=2; y++) {
        for(int x=-2; x<=2; x++) {
            vec4 c = texture2D(source, vUv0 + pixelOffset * vec2(x,y));
            moments += vec2(decodeFloatRG(c.xy), decodeFloatRG(c.zw));
        }
    }
    moments /= 25.0;*/

    /*float weight[7];
    weight[0] = 0.00598;
    weight[1] = 0.060626;
    weight[2] = 0.241843;
    weight[3] = 0.383103;
    weight[4] = 0.241843;
    weight[5] = 0.060626;
    weight[6] = 0.00598;
    vec2 uv = vUv0 - pixelOffset * 3.0;
    for(int i=0; i<7; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i));
        moments += vec2(decodeFloatRG(c.xy), decodeFloatRG(c.zw)) * weight[i];
    }*/

    /*float weight[9];
    weight[0] = 0.000229;
    weight[1] = 0.005977;
    weight[2] = 0.060598;
    weight[3] = 0.241732;
    weight[4] = 0.382928;
    weight[5] = 0.241732;
    weight[6] = 0.060598;
    weight[7] = 0.005977;
    weight[8] = 0.000229;
    vec2 uv = vUv0 - pixelOffset * 4.0;
    for(int i=0; i<9; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i));
        moments += vec2(decodeFloatRG(c.xy), decodeFloatRG(c.zw)) * weight[i];
    }*/

    float weight[13];
    weight[0] = 0.0022181958546457665;
    weight[1] = 0.008773134791588384;
    weight[2] = 0.027023157602879527;
    weight[3] = 0.06482518513852684;
    weight[4] = 0.12110939007484814;
    weight[5] = 0.17621312278855084;
    weight[6] = 0.19967562749792112;
    weight[7] = 0.17621312278855084;
    weight[8] = 0.12110939007484814;
    weight[9] = 0.06482518513852684;
    weight[10] = 0.027023157602879527;
    weight[11] = 0.008773134791588384;
    weight[12] = 0.0022181958546457665;
    vec2 uv = vUv0 - pixelOffset * 6.0;
    for(int i=0; i<13; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i));
        moments += vec2(decodeFloatRG(c.xy), decodeFloatRG(c.zw)) * weight[i];
    }

    gl_FragColor = vec4(encodeFloatRG(moments.x), encodeFloatRG(moments.y));
}

