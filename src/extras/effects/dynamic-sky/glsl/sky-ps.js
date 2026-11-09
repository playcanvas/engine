// The fragment shader of the sky the dynamic sky effect draws, with the vertex shader of the
// engine's sky, skyboxVS: the atmosphere, the lights of the night and the clouds, composited over
// it. The volumetric clouds are read from the texture they were rendered to (DYNSKY_CLOUDS_BUFFER),
// whose light is scaled and range compressed when it is stored at 8 bits per channel
// (DYNSKY_CLOUDS_ENCODED), or evaluated here for the cameras with an orthographic projection.
export default /* glsl */`
    #include "gammaPS"
    #include "tonemappingPS"

    #ifdef PREPASS_PASS
        varying float vLinearDepth;
        #include "floatAsUintPS"
    #endif

    varying vec3 vViewDir;

    #include "dynamicSkyAtmospherePS"

    #if defined(DYNSKY_CLOUDS_FLAT) || defined(DYNSKY_CLOUDS_VOLUMETRIC)
        #include "dynamicSkyCloudsPS"
    #endif

    #ifdef DYNSKY_CLOUDS_BUFFER
        uniform sampler2D dynSkyCloudBuffer;
        uniform mat3 dynSkyBufferMatrix;    // the sky direction to the view space of the camera
        uniform vec2 dynSkyBufferProj;      // the scale of the camera projection

        #ifdef DYNSKY_CLOUDS_ENCODED
            uniform float dynSkyCloudScale;
        #endif

        vec4 dynamicSkyCloudsTap(vec2 uv) {
            vec4 clouds = texture2D(dynSkyCloudBuffer, uv);
            #ifdef DYNSKY_CLOUDS_ENCODED
                clouds.rgb = clouds.rgb / max(1.0 - clouds.rgb, vec3(1e-4)) * dynSkyCloudScale;
            #endif
            return clouds;
        }

        // the clouds in a sky direction, from the texture they were rendered to - the direction is
        // projected the way the pass rendering it derives the direction of each texel. The texture
        // is blurred over 3x3 of its texels, removing the grain of the jitter of the steps: each of
        // the 4 bilinear taps, 2/3 of a texel from the center, weighs 3 texels on each axis evenly
        vec4 dynamicSkyCloudsBuffer(vec3 viewDir) {
            vec3 v = dynSkyBufferMatrix * viewDir;
            vec2 ndc = (v.xy / max(-v.z, 1e-6)) * dynSkyBufferProj;
            vec2 uv = ndc * 0.5 + 0.5;
            #ifdef WEBGPU
                uv.y = 1.0 - uv.y;
            #endif
            vec2 offset = (2.0 / 3.0) / vec2(textureSize(dynSkyCloudBuffer, 0));
            return 0.25 * (
                dynamicSkyCloudsTap(uv + vec2(-offset.x, -offset.y)) +
                dynamicSkyCloudsTap(uv + vec2(offset.x, -offset.y)) +
                dynamicSkyCloudsTap(uv + vec2(-offset.x, offset.y)) +
                dynamicSkyCloudsTap(uv + vec2(offset.x, offset.y))
            );
        }
    #endif

    void main(void) {
        #ifdef PREPASS_PASS
            gl_FragColor = float2vec4(vLinearDepth);
        #else
            // the sky space flips X, matching how the engine samples the environment
            vec3 dir = normalize(vViewDir);
            dir.x *= -1.0;

            vec3 ambient;
            vec3 linear = dynamicSkyBase(dir, ambient);

            // the lights of the sky - the sun disc, and at night the stars and the moon. The branch
            // is the same for all the pixels
            vec3 lights = dynSkySunDisc * (1.0 - dynSkyNightBlend);
            if (dynSkyNightBlend > 0.0) {
                lights += dynamicSkyNightLights(dir) * dynSkyNightBlend;
            }

            // the clouds over the sky and its lights
            #if defined(DYNSKY_CLOUDS_BUFFER)
                linear = dynamicSkyCompositeClouds(linear, lights, dynamicSkyCloudsBuffer(vViewDir), dir);
            #elif defined(DYNSKY_CLOUDS_FLAT)
                linear = dynamicSkyCompositeClouds(linear, lights, dynamicSkyCloudsFlat(dir, ambient), dir);
            #elif defined(DYNSKY_CLOUDS_VOLUMETRIC)
                linear = dynamicSkyCompositeClouds(linear, lights, dynamicSkyCloudsVolumetric(dir, ambient), dir);
            #else
                linear += lights;
            #endif

            // Clamp the sun disc to a value the bloom can handle. The WebGPU bloom down/upsample
            // shaders sum 4 neighbor taps in f16 (half) before scaling, and accumulate mip levels
            // additively - so a very bright pixel overflows those intermediate f16 sums (max 65504)
            // to Inf/NaN and corrupts the whole screen. 6000 keeps every intermediate well in range.
            linear = min(linear, vec3(6000.0));

            gl_FragColor = vec4(gammaCorrectOutput(toneMap(linear)), 1.0);
        #endif
    }
`;
