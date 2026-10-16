export default /* wgsl */`
    // the debug view, declared only while a debug view is displayed
    #ifdef COMPOSE_EFFECT_DEBUG

        // the latest histogram, four bins per element, each relative to the largest bin
        uniform aeHistogram: array<vec4f, 16>;

        // x, y: the darkest and the brightest brightness the average includes, z: the average, w: the
        // brightness the camera exposes as middle grey - each as a position along the histogram, 0-1
        uniform aeMarkers: vec4f;

        // the 'autoexposure' debug view: the scene at the exposure the camera renders with, without
        // the other effects, with the histogram of its brightness drawn along the bottom - the bins
        // the average includes bright, the average in yellow and the brightness the camera exposes
        // as middle grey in blue, which meet once the exposure has adapted
        fn debugAutoexposure() -> vec3f {
            // the pixel sampled, flipped like the composition samples the scene
            let uv = vec2f(uv0.x, mix(uv0.y, 1.0 - uv0.y, uniform.composeTargetFlipY));
            var color = toneMap(max(vec3f(0.0), textureSampleLevel(sceneTexture, sceneTextureSampler, uv, 0.0).rgb));

            // the panel along the bottom of the image, its vertical position growing upwards on
            // every platform
            let panel = (getImageEffectUV(uv) - vec2f(0.05, 0.04)) / vec2f(0.9, 0.22);
            if (all(panel >= vec2f(0.0)) && all(panel <= vec2f(1.0))) {
                let bin = i32(panel.x * 63.0 + 0.5);
                let height = uniform.aeHistogram[bin / 4][bin % 4];
                let included = panel.x >= uniform.aeMarkers.x && panel.x <= uniform.aeMarkers.y;
                color = select(color * 0.15, select(vec3f(0.3), vec3f(0.85), included), panel.y <= height);

                // the markers, two pixels wide
                let halfWidth = uniform.sceneTextureSize.z / 0.9;
                if (abs(panel.x - uniform.aeMarkers.z) < halfWidth) {
                    color = vec3f(1.0, 0.75, 0.1);
                }
                if (abs(panel.x - uniform.aeMarkers.w) < halfWidth) {
                    color = vec3f(0.2, 0.7, 1.0);
                }
            }
            return color;
        }
    #endif
`;
