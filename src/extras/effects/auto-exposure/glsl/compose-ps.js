export default /* glsl */`
    // the debug view, declared only while a debug view is displayed
    #ifdef COMPOSE_EFFECT_DEBUG

        // the latest histogram, four bins per element, each relative to the largest bin
        uniform vec4 aeHistogram[16];

        // x, y: the darkest and the brightest brightness the average includes, z: the average, w: the
        // brightness the camera exposes as middle grey - each as a position along the histogram, 0-1
        uniform vec4 aeMarkers;

        // the 'autoexposure' debug view: the scene at the exposure the camera renders with, without
        // the other effects, with the histogram of its brightness drawn along the bottom - the bins
        // the average includes bright, the average in yellow and the brightness the camera exposes
        // as middle grey in blue, which meet once the exposure has adapted
        vec3 debugAutoexposure() {
            // the pixel sampled, flipped like the composition samples the scene
            vec2 uv = vec2(uv0.x, mix(uv0.y, 1.0 - uv0.y, composeTargetFlipY));
            vec3 color = toneMap(max(vec3(0.0), texture2DLod(sceneTexture, uv, 0.0).rgb));

            // the panel along the bottom of the image, its vertical position growing upwards on
            // every platform
            vec2 panel = (getImageEffectUV(uv) - vec2(0.05, 0.04)) / vec2(0.9, 0.22);
            if (all(greaterThanEqual(panel, vec2(0.0))) && all(lessThanEqual(panel, vec2(1.0)))) {
                int bin = int(panel.x * 63.0 + 0.5);
                float height = aeHistogram[bin / 4][bin - (bin / 4) * 4];
                bool included = panel.x >= aeMarkers.x && panel.x <= aeMarkers.y;
                color = panel.y <= height ? (included ? vec3(0.85) : vec3(0.3)) : color * 0.15;

                // the markers, two pixels wide
                float halfWidth = sceneTextureSize.z / 0.9;
                if (abs(panel.x - aeMarkers.z) < halfWidth) color = vec3(1.0, 0.75, 0.1);
                if (abs(panel.x - aeMarkers.w) < halfWidth) color = vec3(0.2, 0.7, 1.0);
            }
            return color;
        }
    #endif
`;
