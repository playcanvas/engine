export default /* glsl */`
    #if defined(NEAR_BLUR)
        uniform sampler2D nearTexture;
    #endif
    uniform sampler2D farTexture;
    uniform sampler2D cocTexture;

    uniform vec2 kernel[{KERNEL_COUNT}];
    uniform float blurRadiusNear;
    uniform float blurRadiusFar;

    varying vec2 uv0;

    void main()
    {
        vec2 coc = texture2D(cocTexture, uv0).rg;
        float cocFar = coc.r;

        vec3 sum = vec3(0.0, 0.0, 0.0);

        #if defined(NEAR_BLUR)
            // near blur
            float cocNear = coc.g;
            if (cocNear > 0.0001) {

                ivec2 nearTextureSize = textureSize(nearTexture, 0);
                vec2 step = cocNear * blurRadiusNear / vec2(nearTextureSize);

                for (int i = 0; i < {KERNEL_COUNT}; i++) {
                    vec2 uv = uv0 + step * kernel[i];
                    vec3 tap = texture2DLod(nearTexture, uv, 0.0).rgb;
                    sum += tap.rgb;
                }

                sum *= float({INV_KERNEL_COUNT});

            } else
        #endif
            
            if (cocFar > 0.0001) { // far blur

            ivec2 farTextureSize = textureSize(farTexture, 0);
            vec2 step = cocFar * blurRadiusFar / vec2(farTextureSize);

            float sumCoC = 0.0; 
            for (int i = 0; i < {KERNEL_COUNT}; i++) {
                vec2 uv = uv0 + step * kernel[i];
                vec3 tap = texture2DLod(farTexture, uv, 0.0).rgb;

                // block out sharp objects to avoid leaking to far blur
                float cocThis = texture2DLod(cocTexture, uv, 0.0).r;
                tap *= cocThis;
                sumCoC += cocThis;

                sum += tap;
            }

            // average out the sum
            if (sumCoC > 0.0)
                sum /= sumCoC;

            // compensate for the fact the farTexture was premultiplied by CoC
            sum /= cocFar;
        }

        pcFragColor0 = vec4(sum, 1.0);
    }
`;
