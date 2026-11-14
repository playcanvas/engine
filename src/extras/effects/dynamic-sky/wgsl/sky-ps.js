// The fragment shader of the sky the dynamic sky effect draws, see the GLSL version.
export default /* wgsl */`
    #include "gammaPS"
    #include "tonemappingPS"

    #ifdef PREPASS_PASS
        varying vLinearDepth: f32;
        #include "floatAsUintPS"
    #endif

    varying vViewDir: vec3f;

    #include "dynamicSkyAtmospherePS"

    #if defined(DYNSKY_CLOUDS_FLAT) || defined(DYNSKY_CLOUDS_VOLUMETRIC)
        #include "dynamicSkyCloudsPS"
    #endif

    #ifdef DYNSKY_CLOUDS_BUFFER
        var dynSkyCloudBuffer: texture_2d<f32>;
        var dynSkyCloudBufferSampler: sampler;
        uniform dynSkyBufferMatrix: mat3x3f;
        uniform dynSkyBufferProj: vec2f;

        #ifdef DYNSKY_CLOUDS_ENCODED
            uniform dynSkyCloudScale: f32;
        #endif

        fn dynamicSkyCloudsTap(uv: vec2f) -> vec4f {
            var clouds = textureSample(dynSkyCloudBuffer, dynSkyCloudBufferSampler, uv);
            #ifdef DYNSKY_CLOUDS_ENCODED
                clouds = vec4f(clouds.rgb / max(vec3f(1.0) - clouds.rgb, vec3f(1e-4)) * uniform.dynSkyCloudScale, clouds.a);
            #endif
            return clouds;
        }

        // the clouds, blurred over 3x3 texels of their texture - see the GLSL version
        fn dynamicSkyCloudsBuffer(viewDir: vec3f) -> vec4f {
            let v = uniform.dynSkyBufferMatrix * viewDir;
            let ndc = (v.xy / max(-v.z, 1e-6)) * uniform.dynSkyBufferProj;
            let uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
            let offset = (2.0 / 3.0) / vec2f(textureDimensions(dynSkyCloudBuffer, 0));
            return 0.25 * (
                dynamicSkyCloudsTap(uv + vec2f(-offset.x, -offset.y)) +
                dynamicSkyCloudsTap(uv + vec2f(offset.x, -offset.y)) +
                dynamicSkyCloudsTap(uv + vec2f(-offset.x, offset.y)) +
                dynamicSkyCloudsTap(uv + vec2f(offset.x, offset.y))
            );
        }
    #endif

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        #ifdef PREPASS_PASS
            output.color = float2vec4(input.vLinearDepth);
        #else
            var dir = normalize(input.vViewDir);
            dir.x = dir.x * -1.0;

            var ambient: vec3f;
            var linear = dynamicSkyBase(dir, &ambient);

            // the lights of the sky - the sun disc, and at night the stars and the moon
            var lights = dynSkySunDisc * (1.0 - uniform.dynSkyNightBlend);
            if (uniform.dynSkyNightBlend > 0.0) {
                lights = lights + dynamicSkyNightLights(dir) * uniform.dynSkyNightBlend;
            }

            // the clouds over the sky and its lights
            #if defined(DYNSKY_CLOUDS_BUFFER)
                linear = dynamicSkyCompositeClouds(linear, lights, dynamicSkyCloudsBuffer(input.vViewDir), dir);
            #elif defined(DYNSKY_CLOUDS_FLAT)
                linear = dynamicSkyCompositeClouds(linear, lights, dynamicSkyCloudsFlat(dir, ambient), dir);
            #elif defined(DYNSKY_CLOUDS_VOLUMETRIC)
                linear = dynamicSkyCompositeClouds(linear, lights, dynamicSkyCloudsVolumetric(dir, ambient), dir);
            #else
                linear = linear + lights;
            #endif

            // clamped to a value the bloom can handle, see the GLSL version
            linear = min(linear, vec3f(6000.0));

            output.color = vec4f(gammaCorrectOutput(toneMap(linear)), 1.0);
        #endif
        return output;
    }
`;
