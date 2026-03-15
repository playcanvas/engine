export default /* glsl */`
    #ifdef DOF
        uniform sampler2D cocTexture;
        uniform sampler2D blurTexture;
        
        // Global variables for debug
        vec2 dCoc;
        vec3 dBlur;

        // Samples the DOF blur and CoC textures
        vec3 getDofBlur(vec2 uv) {
            dCoc = texture2DLod(cocTexture, uv, 0.0).rg;

            #if DOF_UPSCALE
                vec2 blurTexelSize = 1.0 / vec2(textureSize(blurTexture, 0));
                vec3 bilinearBlur = vec3(0.0);
                float totalWeight = 0.0;

                // 3x3 grid of neighboring texels
                for (int i = -1; i <= 1; i++) {
                    for (int j = -1; j <= 1; j++) {
                        vec2 offset = vec2(i, j) * blurTexelSize;
                        vec2 cocSample = texture2DLod(cocTexture, uv + offset, 0.0).rg;
                        vec3 blurSample = texture2DLod(blurTexture, uv + offset, 0.0).rgb;

                        // Accumulate the weighted blur sample
                        float cocWeight = clamp(cocSample.r + cocSample.g, 0.0, 1.0);
                        bilinearBlur += blurSample * cocWeight;
                        totalWeight += cocWeight;
                    }
                }

                // normalize the accumulated color
                if (totalWeight > 0.0) {
                    bilinearBlur /= totalWeight;
                }

                dBlur = bilinearBlur;
                return bilinearBlur;
            #else
                // when blurTexture is full resolution, just sample it, no upsampling
                dBlur = texture2DLod(blurTexture, uv, 0.0).rgb;
                return dBlur;
            #endif
        }

        vec3 applyDof(vec3 color, vec2 uv) {
            vec3 blur = getDofBlur(uv);
            return mix(color, blur, dCoc.r + dCoc.g);
        }
    #endif
`;
