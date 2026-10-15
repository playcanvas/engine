// Renders the sky of the dynamic sky effect to a face of the cubemap its lighting is generated
// from, with the vertex shader of the engine's reprojection, reprojectVS. The sun disc and the lights
// of the night are left out, and the clouds, of either technique, are evaluated in place. The color
// is encoded by the function of the cubemap's encoding, DYNSKY_ENCODE_FUNC.
export default /* glsl */`
    varying vec2 vUv0;

    uniform float dynSkyFace;

    float saturate(float x) {
        return clamp(x, 0.0, 1.0);
    }

    #include "encodePS"
    #include "dynamicSkyAtmospherePS"

    #if defined(DYNSKY_CLOUDS_FLAT) || defined(DYNSKY_CLOUDS_VOLUMETRIC)
        #include "dynamicSkyCloudsPS"
    #endif

    // the direction of the texel of the face, as the engine's reprojection derives it, which
    // matches how the cubemap is sampled
    vec3 dynamicSkyFaceDirection() {
        vec2 st = vUv0 * 2.0 - 1.0;
        float face = dynSkyFace;

        vec3 vec;
        if (face == 0.0) {
            vec = vec3(1, -st.y, -st.x);
        } else if (face == 1.0) {
            vec = vec3(-1, -st.y, st.x);
        } else if (face == 2.0) {
            vec = vec3(st.x, 1, st.y);
        } else if (face == 3.0) {
            vec = vec3(st.x, -1, -st.y);
        } else if (face == 4.0) {
            vec = vec3(st.x, -st.y, 1);
        } else {
            vec = vec3(-st.x, -st.y, -1);
        }
        return normalize(vec);
    }

    void main(void) {
        vec3 dir = dynamicSkyFaceDirection();

        vec3 ambient;
        vec3 linear = dynamicSkyBase(dir, ambient);

        #if defined(DYNSKY_CLOUDS_FLAT)
            linear = dynamicSkyCompositeClouds(linear, vec3(0.0), dynamicSkyCloudsFlat(dir, ambient), dir);
        #elif defined(DYNSKY_CLOUDS_VOLUMETRIC)
            linear = dynamicSkyCompositeClouds(linear, vec3(0.0), dynamicSkyCloudsVolumetric(dir, ambient), dir);
        #endif

        gl_FragColor = {DYNSKY_ENCODE_FUNC}(linear);
    }
`;
