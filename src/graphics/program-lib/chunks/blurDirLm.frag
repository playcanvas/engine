varying vec2 vUv0;
uniform sampler2D source;
uniform vec2 pixelOffset;

#define SAMPLES 11
uniform float weight[SAMPLES];

void main(void) {
    vec4 c = texture2D(source, vUv0);
    c.w = 0.0;
    //float a = c.w;
    //float weight = 1.0;

    vec2 uv = vUv0 - pixelOffset * (float(SAMPLES) * 0.5);
    uv += pixelOffset * 0.5;
    for(int i=0; i<SAMPLES; i++) {
        vec4 c2 = texture2D(source, uv + pixelOffset * float(i));
        c.w += c2.w * weight[i];
    }
    //c.w /= float(SAMPLES);

    /*if ((c.r + c.g + c.b) > 0.000001) {
        for(int i=1; i<6; i++) {
            vec4 c2 = texture2D(source, vUv0 - pixelOffset * float(i));
            if ((c2.r + c2.g + c2.b) > 0.000001) {
                a += c2.w;
                weight += 1.0;
            } else {
                break;
            }
        }

        for(int i=1; i<6; i++) {
            vec4 c2 = texture2D(source, vUv0 + pixelOffset * float(i));
            if ((c2.r + c2.g + c2.b) > 0.000001) {
                a += c2.w;
                weight += 1.0;
            } else {
                break;
            }
        }

        a /= weight;

        c.w = a;
    }*/

    gl_FragColor = c;
}

