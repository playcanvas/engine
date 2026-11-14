// Renders the volumetric clouds of the dynamic sky effect to a texture of their own, at a reduced
// resolution by default, which the sky reads - rgb the light the clouds scatter toward the viewer, a the fraction of the sky
// behind them they let through. When the texture stores 8 bits per channel (DYNSKY_CLOUDS_ENCODED),
// the light is divided by the brightness of the light on the clouds, so the dark clouds of the
// night keep their precision, and range compressed.
export default /* glsl */`
    varying vec2 uv0;

    uniform mat4 dynSkyInvView;
    uniform vec2 dynSkyProjScale;
    uniform mat3 dynSkyRotation;        // the rotation of the sky, see skyboxVS

    #ifdef DYNSKY_CLOUDS_ENCODED
        uniform float dynSkyCloudScale;
    #endif

    #include "dynamicSkyAtmospherePS"
    #include "dynamicSkyCloudsPS"

    void main(void) {

        // the world space direction of the texel (perspective projection). uv0 addresses
        // textures (getImageEffectUV flips it on WebGPU), so undo the flip to get NDC
        vec2 ndcUV = uv0;
        #ifdef WEBGPU
            ndcUV.y = 1.0 - ndcUV.y;
        #endif
        vec2 ndc = ndcUV * 2.0 - 1.0;
        vec3 world = normalize((dynSkyInvView * vec4(ndc * dynSkyProjScale, -1.0, 0.0)).xyz);

        // to the sky space, as the sky's vertex shader and its fragment shader derive it
        vec3 dir = world * dynSkyRotation;
        dir.x *= -1.0;

        vec4 clouds = dynamicSkyCloudsVolumetric(dir, dynamicSkyAmbient(dir));
        #ifdef DYNSKY_CLOUDS_ENCODED
            vec3 light = clouds.rgb / dynSkyCloudScale;
            clouds.rgb = light / (1.0 + light);
        #endif
        gl_FragColor = clouds;
    }
`;
