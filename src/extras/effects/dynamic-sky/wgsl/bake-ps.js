// Renders the sky of the dynamic sky effect to a face of the cubemap its lighting is generated
// from, see the GLSL version.
export default /* wgsl */`
    varying vUv0: vec2f;

    uniform dynSkyFace: f32;

    #include "encodePS"
    #include "dynamicSkyAtmospherePS"

    #if defined(DYNSKY_CLOUDS_FLAT) || defined(DYNSKY_CLOUDS_VOLUMETRIC)
        #include "dynamicSkyCloudsPS"
    #endif

    fn dynamicSkyFaceDirection(uv: vec2f) -> vec3f {
        let st = uv * 2.0 - 1.0;
        let face = uniform.dynSkyFace;

        var vec: vec3f;
        if (face == 0.0) {
            vec = vec3f(1.0, -st.y, -st.x);
        } else if (face == 1.0) {
            vec = vec3f(-1.0, -st.y, st.x);
        } else if (face == 2.0) {
            vec = vec3f(st.x, 1.0, st.y);
        } else if (face == 3.0) {
            vec = vec3f(st.x, -1.0, -st.y);
        } else if (face == 4.0) {
            vec = vec3f(st.x, -st.y, 1.0);
        } else {
            vec = vec3f(-st.x, -st.y, -1.0);
        }
        return normalize(vec);
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let dir = dynamicSkyFaceDirection(input.vUv0);

        var ambient: vec3f;
        var linear = dynamicSkyBase(dir, &ambient);

        #if defined(DYNSKY_CLOUDS_FLAT)
            linear = dynamicSkyCompositeClouds(linear, vec3f(0.0), dynamicSkyCloudsFlat(dir, ambient), dir);
        #elif defined(DYNSKY_CLOUDS_VOLUMETRIC)
            linear = dynamicSkyCompositeClouds(linear, vec3f(0.0), dynamicSkyCloudsVolumetric(dir, ambient), dir);
        #endif

        output.color = {DYNSKY_ENCODE_FUNC}(linear);
        return output;
    }
`;
