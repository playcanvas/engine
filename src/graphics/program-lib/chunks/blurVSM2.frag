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

    vec2 XY = texture2D(source, vUv0).xy;

    //moments.y = 1000.0;

    vec2 uv = vUv0 - pixelOffset * 6.0;
    for(int i=0; i<13; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i));

        float d = decodeFloatRG(c.zw);
        d = decodeFloatRG(c.zw);
        moments.y += d * weight[i];

        //moments.y = min(moments.y, d);
        /*float sm = 120.0;
        float minimum = min(-moments.y*sm, -d*sm);
        float maximum = max(-moments.y*sm, -d*sm);
        moments.y = -(maximum + log( 1.0 + exp((minimum - maximum)*1.0) )) / sm; // soft maximum*/
    }

    gl_FragColor = vec4(XY, encodeFloatRG(moments.y));
}

