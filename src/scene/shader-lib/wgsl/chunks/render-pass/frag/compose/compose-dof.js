export default /* wgsl */`
    #ifdef DOF
        var cocTexture: texture_2d<f32>;
        var cocTextureSampler: sampler;
        var blurTexture: texture_2d<f32>;
        var blurTextureSampler: sampler;
        
        // Global variables for debug
        var<private> dCoc: vec2f;
        var<private> dBlur: vec3f;

        // Samples the DOF blur and CoC textures
        fn getDofBlur(uv: vec2f) -> vec3f {
            dCoc = textureSampleLevel(cocTexture, cocTextureSampler, uv, 0.0).rg;

            #if DOF_UPSCALE
                let blurTexelSize = 1.0 / vec2f(textureDimensions(blurTexture, 0));
                var bilinearBlur = vec3f(0.0);
                var totalWeight = 0.0;

                // 3x3 grid of neighboring texels
                for (var i = -1; i <= 1; i++) {
                    for (var j = -1; j <= 1; j++) {
                        let offset = vec2f(f32(i), f32(j)) * blurTexelSize;
                        let cocSample = textureSampleLevel(cocTexture, cocTextureSampler, uv + offset, 0.0).rg;
                        let blurSample = textureSampleLevel(blurTexture, blurTextureSampler, uv + offset, 0.0).rgb;

                        // Accumulate the weighted blur sample
                        let cocWeight = clamp(cocSample.r + cocSample.g, 0.0, 1.0);
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
                dBlur = textureSampleLevel(blurTexture, blurTextureSampler, uv, 0.0).rgb;
                return dBlur;
            #endif
        }

        fn applyDof(color: vec3f, uv: vec2f) -> vec3f {
            let blur = getDofBlur(uv);
            return mix(color, blur, dCoc.r + dCoc.g);
        }
    #endif
`;
