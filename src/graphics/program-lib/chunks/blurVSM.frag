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


void main(void) {
    vec2 moments = vec2(0.0);

    // AESM
    //moments.y = 1000.0;

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

    // AESM
    float centerDepth = decodeFloatRG(texture2D(source, vUv0).xy);
    float count = 0.0;
    float y = 0.0;

    vec4 momentsDiv8encoded = texture2D(sourceDiv8, vUv0);
    vec2 momentsDiv8 = vec2(decodeFloatRG(momentsDiv8encoded.xy), decodeFloatRG(momentsDiv8encoded.zw));
    float d = centerDepth - momentsDiv8.y;
    float dd = saturate(d * 4.0);
    float r = 1.0;//dd;//clamp(dd, 0.5, 1.0);

    /*float bd1 = momentsDiv8.x;
    float bd2 = momentsDiv8.y;
    float bdepth = saturate(bd1 - sqrt( saturate(bd2 - bd1*bd1) ));
    r = saturate( (0.1 * (centerDepth - moments.y) / moments.y) * 35.0 );
    r = clamp(r, 0.5, 1.0);*/

    vec2 uv = vUv0 - pixelOffset * 6.5 * r;
    //uv.x = uv.x * outputMad.x + outputMad.y;
    float accum = 0.0;

    vec2 uv8 = vUv0 - pixelOffset * 6.5 * 8.0;
    for(int i=0; i<13; i++) {
        vec4 c = texture2D(source, uv + pixelOffset * float(i) * r);
        if (r > 0.8) {
            //c = texture2D(sourceDiv8, uv + pixelOffset * float(i) * r);
        }

        // VSM
        //moments += vec2(decodeFloatRG(c.xy), decodeFloatRG(c.zw)) * weight[i];

        //accum += decodeFloatRGBA(c) * weight[i];
        // AESM
        //float d = decodeFloatRG(c.xy);
        float d = c.x;
        moments.x += d * weight[i];
        //d = decodeFloatRG(c.zw);
        d = c.y;

        moments.y += d * weight[i];


        //moments.y = min(moments.y, d);

        //moments.y += decodeFloatRG(texture2D(sourceDiv8, uv8 + pixelOffset * float(i) * 8.0).zw) * weight[i];

        //moments.y = min(moments.y, mix(centerDepth, d, 1.0-pow(1.0-weight[i],32.0)));

        //y += d - centerDepth * weight[i];

        float sm = 120.0;
        //sm = mix(0.0, 150.0, saturate(weight[i]*2.0));
        //moments.y = log((exp(moments.y*sm) + exp((1.0 - d)*sm))) / sm;

        //float minimum = min(moments.y*sm, d*sm);
        //float maximum = max(moments.y*sm, d*sm);
        //moments.y = (maximum + log( 1.0 + exp((minimum - maximum)*1.0) )) / sm; // soft maximum

        /*if (d < (centerDepth+0.1)) {
            moments.y += d;// * weight[i];
            count += 1.0;
        }*/
    }

    /*float vSample[ 13 ];

    float scale = 0.5;
    for (int i = 0; i < 13; i++)
    {
        vSample[i] = decodeFloatRG(texture2D(source, uv + pixelOffset * float(i)).xy) * scale;
    }

    float fAccum;
    fAccum = log_conv( weight[0], vSample[0], weight[1], vSample[1] );
    for (int i = 2; i < 13; i++)
    {
        fAccum = log_conv( 1.0, fAccum, weight[i], vSample[i] );
    }
    moments.x = fAccum / scale;*/


    /*if (count > 0.0) {
        moments.y /= count;
    } else {
        moments.y = centerDepth;
    }*/

    //moments.y = 1.0 - moments.y; // invert soft maximum

    /*if (y < centerDepth) {
        moments.y = y;
    }*/
    //moments.y = saturate(y) + centerDepth;

        //moments.y = momentsDiv8.y;


    //moments.y = clamp(bdepth, 0.0, 0.99);//wpen;

    //gl_FragColor = vec4(encodeFloatRG(moments.x), encodeFloatRG(moments.y));
    //gl_FragColor = encodeFloatRGBA(accum);
    gl_FragColor = vec4(moments.x, moments.y, 0.0, 0.0);
    //gl_FragColor.zw = momentsDiv8encoded.zw;

    //gl_FragColor = momentsDiv8encoded;
    //gl_FragColor = vec4(dd);
}

