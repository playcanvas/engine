// uniforms for a light with index {i}, driven by defines
export default /* wgsl */`
#if defined(LIGHT{i})

    uniform light{i}_color: vec3f;

    #if LIGHT{i}TYPE == DIRECTIONAL
        uniform light{i}_direction: vec3f;
    #else

        #define LIT_CODE_LIGHTS_POINT // include functionality for point lights

        uniform light{i}_position: vec3f;
        uniform light{i}_radius: f32;

        #if LIGHT{i}TYPE == SPOT

            #define LIT_CODE_LIGHTS_SPOT // include functionality for spot lights

            uniform light{i}_direction: vec3f;
            uniform light{i}_innerConeAngle: f32;
            uniform light{i}_outerConeAngle: f32;
        #endif
    #endif

    // area lights
    #if LIGHT{i}SHAPE != PUNCTUAL

        #define LIT_CODE_FALLOFF_SQUARED // include functionality for inverse squared falloff

        #if LIGHT{i}TYPE == DIRECTIONAL
            uniform light{i}_position: vec3f;
        #endif
        uniform light{i}_halfWidth: vec3f;
        uniform light{i}_halfHeight: vec3f;
    #else

        #if LIGHT{i}FALLOFF == LINEAR
            #define LIT_CODE_FALLOFF_LINEAR // include functionality for linear falloff
        #endif

        #if LIGHT{i}FALLOFF == INVERSESQUARED
            #define LIT_CODE_FALLOFF_SQUARED // include functionality for inverse squared falloff
        #endif

    #endif

    // shadow casting
    #if defined(LIGHT{i}CASTSHADOW)

        uniform light{i}_shadowMatrix: mat4x4f;
        uniform light{i}_shadowIntensity: f32;
        uniform light{i}_shadowParams: vec4f; // width, height, bias, radius

        #if LIGHT{i}SHADOWTYPE == PCSS_32F
            uniform light{i}_shadowSearchArea: f32;
            uniform light{i}_cameraParams: vec4f;
            #if LIGHT{i}TYPE == DIRECTIONAL
                uniform light{i}_softShadowParams: vec4f;
            #endif
        #endif

        // directional (cascaded) shadows
        #if LIGHT{i}TYPE == DIRECTIONAL
            uniform light{i}_shadowMatrixPalette: array<mat4x4f, 4>;
            uniform light{i}_shadowCascadeDistances: vec4f;
            uniform light{i}_shadowCascadeCount: i32;
            uniform light{i}_shadowCascadeBlend: f32;
        #endif

        #if LIGHT{i}TYPE == OMNI
            NOT SUPPORTED
/*            #if defined(LIGHT{i}SHADOW_PCF)
                uniform samplerCubeShadow light{i}_shadowMap;
            #else
                uniform samplerCube light{i}_shadowMap;
            #endif
*/            
        #else
            #if defined(LIGHT{i}SHADOW_PCF)
                var light{i}_shadowMap: texture_depth_2d;
                var light{i}_shadowMapSampler: sampler_comparison;
            #else
                var light{i}_shadowMap: texture_2d<f32>;
                var light{i}_shadowMapSampler: sampler;
            #endif
        #endif

    #endif

    // cookie
    #if defined(LIGHT{i}COOKIE)

        #define LIT_CODE_COOKIE // include functionality for cookies

        #if LIGHT{i}TYPE == OMNI
            NOT SUPPORTED
/*        
            uniform samplerCube light{i}_cookie;
            uniform float light{i}_cookieIntensity;
            #if !defined(LIGHT{i}CASTSHADOW)
                uniform mat4 light{i}_shadowMatrix;
            #endif
*/
        #endif

        #if LIGHT{i}TYPE == SPOT
            NOT SUPPORTED
/*            uniform sampler2D light{i}_cookie;
            uniform float light{i}_cookieIntensity;
            #if !defined(LIGHT{i}CASTSHADOW)
                uniform mat4 light{i}_shadowMatrix;
            #endif
            #if defined(LIGHT{i}COOKIE_TRANSFORM)
                uniform vec4 light{i}_cookieMatrix;
                uniform vec2 light{i}_cookieOffset;
            #endif
*/
        #endif
    #endif
#endif
`;
