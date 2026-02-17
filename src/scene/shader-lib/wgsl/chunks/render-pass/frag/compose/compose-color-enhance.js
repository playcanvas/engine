export default /* wgsl */`
    #ifdef COLOR_ENHANCE
        uniform colorEnhanceParams: vec4f; // x=shadows, y=highlights, z=vibrance, w=dehaze
        uniform colorEnhanceMidtones: f32;

        fn applyColorEnhance(color: vec3f) -> vec3f {
            var colorOut = color;
            var maxChannel = max(colorOut.r, max(colorOut.g, colorOut.b));
            var lum = dot(colorOut, vec3f(0.2126, 0.7152, 0.0722));

            // Shadows/Highlights - skip if both are zero (coherent branch, essentially free)
            // Uses exponential curve: pow(2, param) gives 0.5x at -1, 1x at 0, 2x at +1
            if (uniform.colorEnhanceParams.x != 0.0 || uniform.colorEnhanceParams.y != 0.0) {
                var logLum = log2(max(lum, 0.001)) / 10.0 + 0.5;
                logLum = clamp(logLum, 0.0, 1.0);

                let shadowWeight = pow(1.0 - logLum, 2.0);
                let highlightWeight = pow(logLum, 2.0);

                colorOut *= pow(2.0, uniform.colorEnhanceParams.x * shadowWeight);
                colorOut *= pow(2.0, uniform.colorEnhanceParams.y * highlightWeight);
            }

            // Midtones - localized exposure in log-luminance space
            if (uniform.colorEnhanceMidtones != 0.0) {
                let pivot = 0.18;
                let widthStops = 1.25;
                let maxStops = 2.0;
                let y = max(dot(colorOut, vec3f(0.2126, 0.7152, 0.0722)), 1e-6);

                // 0 at pivot, +/-1 one stop away from pivot
                let d = log2(y / pivot);
                let w = exp(-(d * d) / (2.0 * widthStops * widthStops));
                let stops = uniform.colorEnhanceMidtones * maxStops * w;
                colorOut *= exp2(stops);
            }

            // Vibrance - skip if zero (coherent branch)
            if (uniform.colorEnhanceParams.z != 0.0) {
                let minChannel = min(colorOut.r, min(colorOut.g, colorOut.b));
                maxChannel = max(colorOut.r, max(colorOut.g, colorOut.b));
                let sat = (maxChannel - minChannel) / max(maxChannel, 0.001);

                lum = dot(colorOut, vec3f(0.2126, 0.7152, 0.0722));
                let normalizedLum = lum / max(1.0, maxChannel);
                let grey = vec3f(normalizedLum) * maxChannel;

                let satBoost = uniform.colorEnhanceParams.z * (1.0 - sat);
                colorOut = mix(grey, colorOut, 1.0 + satBoost);
            }

            // Dehaze - skip if zero (coherent branch)
            // Based on dark channel prior: haze lifts the minimum RGB channel
            if (uniform.colorEnhanceParams.w != 0.0) {
                // Normalize to work in HDR
                maxChannel = max(colorOut.r, max(colorOut.g, colorOut.b));
                let scale = max(1.0, maxChannel);
                let normalized = colorOut / scale;

                // Estimate transmission from dark channel (per-pixel approximation)
                let darkChannel = min(normalized.r, min(normalized.g, normalized.b));
                let atmosphericLight = 0.95;

                // transmission: 1 = clear, 0 = fully hazed
                // strength controls how aggressively we remove haze
                var t = 1.0 - uniform.colorEnhanceParams.w * darkChannel / atmosphericLight;
                t = max(t, 0.1); // prevent extreme amplification

                // Dehaze formula: J = (I - A) / t + A
                let dehazed = (normalized - atmosphericLight) / t + atmosphericLight;

                // Restore HDR range
                colorOut = dehazed * scale;
            }

            return max(vec3f(0.0), colorOut);
        }
    #endif
`;
