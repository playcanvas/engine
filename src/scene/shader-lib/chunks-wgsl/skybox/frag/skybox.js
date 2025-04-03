export default /* wgsl */`
    #define LIT_SKYBOX_INTENSITY

    #include "envProcPS"
    #include "gammaPS"
    #include "tonemappingPS"

    // Varying and uniform declarations
    varying vViewDir : vec3f;
    uniform skyboxHighlightMultiplier : f32;

    #ifdef SKY_CUBEMAP

        var texture_cubeMap : texture_cube<f32>;
        var texture_cubeMap_sampler : sampler;

        #ifdef SKYMESH
            varying vWorldPos : vec3f;
            uniform cubeMapRotationMatrix : mat3x3f;
            uniform projectedSkydomeCenter : vec3f;
        #endif

    #else // env-atlas

        #include "sphericalPS"
        #include "envAtlasPS"

        var texture_envAtlas : texture_2d<f32>;
        var texture_envAtlas_sampler : sampler;

        uniform mipLevel : f32;

    #endif

    @fragment
    fn fragmentMain(input : FragmentInput) -> FragmentOutput {

        var linear : vec3f;
        var dir : vec3f;

        #ifdef SKY_CUBEMAP

            #ifdef SKYMESH
                // get vector from world space pos to tripod origin
                var envDir : vec3f = normalize(input.vWorldPos - uniform.projectedSkydomeCenter);
                dir = envDir * uniform.cubeMapRotationMatrix;
            #else
                dir = input.vViewDir;
            #endif

            dir.x *= -1.0;
            linear = {SKYBOX_DECODE_FNC}(textureSample(texture_cubeMap, texture_cubeMap_sampler, dir));

        #else // env-atlas

            dir = input.vViewDir * vec3f(-1.0, 1.0, 1.0);
            let uv : vec2f = toSphericalUv(normalize(dir));
            linear = {SKYBOX_DECODE_FNC}(textureSample(texture_envAtlas, texture_envAtlas_sampler, mapRoughnessUv(uv, uniform.mipLevel)));

        #endif

        // our HDR encodes values up to 64, so allow extra brightness for the clipped values
        if (any(linear >= vec3f(64.0))) {
            linear *= uniform.skyboxHighlightMultiplier;
        }
        
        var output: FragmentOutput;
        output.color = vec4f(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
        return output;
    }
`;
