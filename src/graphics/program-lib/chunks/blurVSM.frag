varying vec2 vUv0;
uniform sampler2D source;
uniform sampler2D sourceDiv8;
uniform vec2 pixelOffset;
uniform vec2 outputMad;

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

float log_conv ( float x0, float X, float y0, float Y ) {
    return ( X + log( x0 + (y0 * exp(Y - X) ) ) );
}

float decodeFloatRGBA( vec4 rgba ) {
  return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/160581375.0) );
}

vec4 encodeFloatRGBA( float v ) {
  vec4 enc = vec4(1.0, 255.0, 65025.0, 160581375.0) * v;
  enc = fract(enc);
  enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
  return enc;
}

float decodeSuperHalf( vec2 enc ) {
    float y = enc.y * 10.0;
    float exponent = floor(y);
    float significand = (y - exponent) * (1.0/255.0) + enc.x;
    return significand * pow(10.0, exponent);
}

vec2 encodeSuperHalf( float x ) {
    float exponent = floor(log(floor(x) * 10.0) / log(10.0));
    if (floor(x)==0.0) exponent = 0.0; // TODO: do better
    float significand = x / pow(10.0, exponent);
    float encX = significand;
    float encY = fract(255.0 * significand);
    encX -= encY / 255.0;
    encY -= encY / 255.0;
    float encY2 = encY*0.1 + exponent*0.1;
    return vec2(encX, encY2);
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

    // AESM
    float centerDepth = decodeFloatRG(texture2D(source, vUv0).xy);
    float count = 0.0;
    float y = 0.0;

    vec4 momentsDiv8encoded = texture2D(sourceDiv8, vUv0);
    vec2 momentsDiv8 = vec2(decodeFloatRG(momentsDiv8encoded.xy), decodeFloatRG(momentsDiv8encoded.zw));
    float d = centerDepth - momentsDiv8.y;
    float dd = saturate(d * 4.0);
    float r = 1.0;//dd;//clamp(dd, 0.5, 1.0);

    vec2 uv = vUv0 - pixelOffset * 6.5 * r;
    //uv.x = uv.x * outputMad.x + outputMad.y;
    float accum = 0.0;

    vec2 uv8 = vUv0 - pixelOffset * 6.5 * 8.0;
    for(int i=0; i<13; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i) * r);

        // VSM
        moments += vec2(decodeSuperHalf(c.xy), decodeSuperHalf(c.zw)) * weight[i];
        //moments += c.xy * weight[i];

        //float d = c.x;
        //moments.x += d * weight[i];
        //d = c.y;
        //moments.y += d * weight[i];


        //moments.y = min(moments.y, d);

        //moments.y += decodeFloatRG(texture2D(sourceDiv8, uv8 + pixelOffset * float(i) * 8.0).zw) * weight[i];

        //moments.y = min(moments.y, mix(centerDepth, d, 1.0-pow(1.0-weight[i],32.0)));

        //y += d - centerDepth * weight[i];
    }

    gl_FragColor = vec4(encodeSuperHalf(moments.x), encodeSuperHalf(moments.y));
    //gl_FragColor = vec4(encodeFloatRG(moments.x), encodeFloatRG(moments.y));
    //gl_FragColor = encodeFloatRGBA(accum);
    //gl_FragColor = vec4(moments.x, moments.y, 0.0, 0.0);
    //gl_FragColor.zw = momentsDiv8encoded.zw;

    //gl_FragColor = momentsDiv8encoded;
    //gl_FragColor = vec4(dd);
}

