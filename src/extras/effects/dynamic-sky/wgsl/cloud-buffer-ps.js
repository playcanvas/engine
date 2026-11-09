// Renders the volumetric clouds of the dynamic sky effect to a texture of their own, see the GLSL
// version.
export default /* wgsl */`
    varying uv0: vec2f;

    uniform dynSkyInvView: mat4x4f;
    uniform dynSkyProjScale: vec2f;
    uniform dynSkyRotation: mat3x3f;

    #ifdef DYNSKY_CLOUDS_ENCODED
        uniform dynSkyCloudScale: f32;
    #endif

    #include "dynamicSkyAtmospherePS"
    #include "dynamicSkyCloudsPS"

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        // uv0 addresses textures (getImageEffectUV flips it on WebGPU), so undo the flip to get NDC
        let ndcUV = vec2f(input.uv0.x, 1.0 - input.uv0.y);
        let ndc = ndcUV * 2.0 - 1.0;
        let world = normalize((uniform.dynSkyInvView * vec4f(ndc * uniform.dynSkyProjScale, -1.0, 0.0)).xyz);

        var dir = world * uniform.dynSkyRotation;
        dir.x = dir.x * -1.0;

        var clouds = dynamicSkyCloudsVolumetric(dir, dynamicSkyAmbient(dir));
        #ifdef DYNSKY_CLOUDS_ENCODED
            let light = clouds.rgb / uniform.dynSkyCloudScale;
            clouds = vec4f(light / (vec3f(1.0) + light), clouds.a);
        #endif
        output.color = clouds;
        return output;
    }
`;
