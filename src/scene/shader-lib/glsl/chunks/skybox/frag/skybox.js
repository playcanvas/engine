export default /* glsl */`
    #define LIT_SKYBOX_INTENSITY

    #include "envProcPS"
    #include "gammaPS"
    #include "tonemappingPS"

    #ifdef PREPASS_PASS
        varying float vLinearDepth;
        #include "floatAsUintPS"
    #endif

    varying vec3 vViewDir;
    uniform float skyboxHighlightMultiplier;

    #if defined(SKY_FISHEYE) && !defined(SKYMESH)
        uniform float fisheye_k;
        uniform float fisheye_invK;
        uniform float fisheye_projMat00;
        uniform float fisheye_projMat11;
        uniform mat4 matrix_view;
        uniform mat3 cubeMapRotationMatrix;
        varying vec3 vClipXYW;
    #endif

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

        #ifdef PREPASS_PASS

            // output linear depth during prepass
            gl_FragColor = float2vec4(vLinearDepth);

        #else

            // --- compute view direction ---

            #if defined(SKY_FISHEYE) && !defined(SKYMESH)

                vec2 ndc = vClipXYW.xy / vClipXYW.z;
                float px = ndc.x / fisheye_projMat00;
                float py = ndc.y / fisheye_projMat11;
                float r = sqrt(px * px + py * py);
                float theta = fisheye_k * atan(r * fisheye_invK);
                float sinT = sin(theta);
                float cosT = cos(theta);
                vec3 camDir = (r > 1e-6)
                    ? vec3(px / r * sinT, py / r * sinT, -cosT)
                    : vec3(0.0, 0.0, -1.0);
                vec3 dir = transpose(mat3(matrix_view)) * camDir;
                dir = dir * cubeMapRotationMatrix;

            #elif defined(SKY_CUBEMAP) && defined(SKYMESH)

                // get vector from world space pos to tripod origin
                vec3 envDir = normalize(vWorldPos - projectedSkydomeCenter);
                vec3 dir = envDir * cubeMapRotationMatrix;

            #else

                vec3 dir = vViewDir;

            #endif

            // --- sample environment ---

            #ifdef SKY_CUBEMAP

                dir.x *= -1.0;
                vec3 linear = {SKYBOX_DECODE_FNC}(textureCube(texture_cubeMap, dir));

            #else // env-atlas

                dir *= vec3(-1.0, 1.0, 1.0);
                vec2 uv = toSphericalUv(normalize(dir));
                vec3 linear = {SKYBOX_DECODE_FNC}(texture2D(texture_envAtlas, mapRoughnessUv(uv, mipLevel)));

            #endif

            // our HDR encodes values up to 64, so allow extra brightness for the clipped values
            if (any(greaterThanEqual(linear, vec3(64.0)))) {
                linear *= skyboxHighlightMultiplier;
            }

            gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);

        #endif
    }
`;
