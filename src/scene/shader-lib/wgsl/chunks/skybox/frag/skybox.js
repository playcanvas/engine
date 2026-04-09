export default /* wgsl */`
    #define LIT_SKYBOX_INTENSITY

    #include "envProcPS"
    #include "gammaPS"
    #include "tonemappingPS"

    #ifdef PREPASS_PASS
        varying vLinearDepth: f32;
        #include "floatAsUintPS"
    #endif

    // Varying and uniform declarations
    varying vViewDir : vec3f;
    uniform skyboxHighlightMultiplier : f32;

    #if defined(SKY_FISHEYE) && !defined(SKYMESH)
        uniform fisheye_k : f32;
        uniform fisheye_invK : f32;
        uniform fisheye_projMat00 : f32;
        uniform fisheye_projMat11 : f32;
        uniform matrix_view : mat4x4f;
        uniform cubeMapRotationMatrix : mat3x3f;
        varying vClipXYW : vec3f;
    #endif

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

        var output: FragmentOutput;

        #ifdef PREPASS_PASS

            // output linear depth during prepass
            output.color = float2vec4(vLinearDepth);

        #else

            var linear : vec3f;
            var dir : vec3f;

            // --- compute view direction ---

            #if defined(SKY_FISHEYE) && !defined(SKYMESH)

                let ndc : vec2f = input.vClipXYW.xy / input.vClipXYW.z;
                let px : f32 = ndc.x / uniform.fisheye_projMat00;
                let py : f32 = ndc.y / uniform.fisheye_projMat11;
                let r : f32 = sqrt(px * px + py * py);
                let theta : f32 = uniform.fisheye_k * atan(r * uniform.fisheye_invK);
                let sinT : f32 = sin(theta);
                let cosT : f32 = cos(theta);
                var camDir : vec3f;
                if (r > 1e-6) {
                    camDir = vec3f(px / r * sinT, py / r * sinT, -cosT);
                } else {
                    camDir = vec3f(0.0, 0.0, -1.0);
                }
                let viewMat3 : mat3x3f = mat3x3f(
                    uniform.matrix_view[0].xyz,
                    uniform.matrix_view[1].xyz,
                    uniform.matrix_view[2].xyz
                );
                dir = transpose(viewMat3) * camDir;
                dir = dir * uniform.cubeMapRotationMatrix;

            #elif defined(SKY_CUBEMAP) && defined(SKYMESH)

                // get vector from world space pos to tripod origin
                var envDir : vec3f = normalize(input.vWorldPos - uniform.projectedSkydomeCenter);
                dir = envDir * uniform.cubeMapRotationMatrix;

            #else

                dir = input.vViewDir;

            #endif

            // --- sample environment ---

            #ifdef SKY_CUBEMAP

                dir.x *= -1.0;
                linear = {SKYBOX_DECODE_FNC}(textureSample(texture_cubeMap, texture_cubeMap_sampler, dir));

            #else // env-atlas

                dir *= vec3f(-1.0, 1.0, 1.0);
                let uv : vec2f = toSphericalUv(normalize(dir));
                linear = {SKYBOX_DECODE_FNC}(textureSample(texture_envAtlas, texture_envAtlas_sampler, mapRoughnessUv(uv, uniform.mipLevel)));

            #endif

            // our HDR encodes values up to 64, so allow extra brightness for the clipped values
            if (any(linear >= vec3f(64.0))) {
                linear *= uniform.skyboxHighlightMultiplier;
            }
            
            output.color = vec4f(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);

        #endif

        return output;
    }
`;
