varying vec2 vUv0;
uniform sampler2D source;
uniform vec2 pixelOffset;
void main(void) {
    vec4 c = texture2D(source, vUv0);
    float mask = 0.0;

    if ((c.r + c.g + c.b) > 0.000001) {

        const mat3 Kx = mat3(
        -1, 0, 1,
        -2, 0, 2,
        -1, 0, 1);

        const mat3 Ky = mat3(
        1, 2, 1,
        0, 0, 0,
        -1,-2,-1);

        float Lx = 0.0;
        float Ly = 0.0;

        const int S = 1;

        for (int y = -S; y <= S; ++y) {
            for (int x = -S; x<= S; ++x) {
                vec2 offset = vec2(x,y) * (1.0 / 4096.0);
                vec4 c2 = texture2D(source, vUv0 + offset);

                if ((c2.r + c2.g + c2.b) < 0.000001) {
                    c2 = c;
                }

                float luminance = c2.z;//dot(c2.xyz, vec3(1.0));
                Lx += luminance * Kx[y+1][x+1];
                Ly += luminance * Ky[y+1][x+1];
            }
        }

        c.w = sqrt((Lx*Lx) + (Ly*Ly)) * 100.0;
    }

    /*
        //c.xyz = c.xyz * 2.0 - vec3(1.0);
        vec4 prev = c;
        //float weight = 0.0;

        //float threshold = 2.0 / 255.0;
        float threshold = 0.0;//1;

        for(int i=1; i<6; i++) {
            vec4 c2 = texture2D(source, vUv0 - pixelOffset * float(i));
            if ((c2.r + c2.g + c2.b) > 0.000001) {
                //c2.xyz = c2.xyz * 2.0 - vec3(1.0);
                //float diff = 1.0 - max(dot(prev.xyz, c2.xyz),0.0);
                float diff = abs(dot(c2.xyz - prev.xyz, vec3(1.0)));
                mask += max(diff - threshold, 0.0);
                //if (pixelOffset.y > 0.00000001) mask += c2.w;
                //weight += 1.0;
                prev = c2;
            } else {
                break;
            }
        }

        prev = c;

        for(int i=1; i<6; i++) {
            vec4 c2 = texture2D(source, vUv0 + pixelOffset * float(i));
            if ((c2.r + c2.g + c2.b) > 0.000001) {
                //c2.xyz = c2.xyz * 2.0 - vec3(1.0);
                //float diff = 1.0 - max(dot(prev.xyz, c2.xyz),0.0);
                float diff = abs(dot(c2.xyz - prev.xyz, vec3(1.0)));
                mask += max(diff - threshold, 0.0);
                //if (pixelOffset.y > 0.00000001) mask += c2.w;
                //weight += 1.0;
                prev = c2;
            } else {
                break;
            }
        }

        //if (weight > 0.0) mask /= weight;

        //c.xyz = c.xyz * 0.5 + vec3(0.5);

        if (mask > 30.0 / 255.0) {
            mask = 1.0;
        } else {
            mask = 0.0;
        }

        if (pixelOffset.y > 0.00000001) {
            c.w += min(mask, 1.0); // only add hor + ver
            //c.w = max(c.w, mask);
        } else {
            c.w = min(mask, 1.0);
        }
    }*/

    gl_FragColor = c;
}

