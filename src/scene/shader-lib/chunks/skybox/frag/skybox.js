export default /* glsl */`
    #define LIT_SKYBOX_INTENSITY

    #include "envProcPS"
    #include "gammaPS"
    #include "tonemappingPS"

    varying vec3 vViewDir;
    uniform float skyboxHighlightMultiplier;

    #ifdef SKY_CUBEMAP

        uniform samplerCube texture_cubeMap;

        #ifdef SKYMESH
            varying vec3 vWorldPos;
            uniform mat3 cubeMapRotationMatrix;
            uniform vec3 projectedSkydomeCenter;
        #endif

    #else // env-atlas

        #include "sphericalPS"
        #include "envAtlasPS"

        uniform sampler2D texture_envAtlas;
        uniform float mipLevel;

    #endif

    void main(void) {

        #ifdef SKY_CUBEMAP

            #ifdef SKYMESH

                // get vector from world space pos to tripod origin
                vec3 envDir = normalize(vWorldPos - projectedSkydomeCenter);
                vec3 dir = envDir * cubeMapRotationMatrix;

            #else

                vec3 dir = vViewDir;

            #endif

            dir.x *= -1.0;
            vec3 linear = {SKYBOX_DECODE_FNC}(textureCube(texture_cubeMap, dir));

        #else // env-atlas

            vec3 dir = vViewDir * vec3(-1.0, 1.0, 1.0);
            vec2 uv = toSphericalUv(normalize(dir));

            vec3 linear = {SKYBOX_DECODE_FNC}(texture2D(texture_envAtlas, mapRoughnessUv(uv, mipLevel)));

        #endif

        // our HDR encodes values up to 64, so allow extra brightness for the clipped values
        if (any(greaterThanEqual(linear, vec3(64.0)))) {
            linear *= skyboxHighlightMultiplier;
        }

        gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
    }
`;
