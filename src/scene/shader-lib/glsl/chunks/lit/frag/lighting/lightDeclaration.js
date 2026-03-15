// uniforms for a light with index {i}, driven by defines
export default /* glsl */`
#if defined(LIGHT{i})

    uniform vec3 light{i}_color;

    #if LIGHT{i}TYPE == DIRECTIONAL
        uniform vec3 light{i}_direction;
    #else

        #define LIT_CODE_LIGHTS_POINT // include functionality for point lights

        uniform vec3 light{i}_position;
        uniform float light{i}_radius;

        #if LIGHT{i}TYPE == SPOT

            #define LIT_CODE_LIGHTS_SPOT // include functionality for spot lights

            uniform vec3 light{i}_direction;
            uniform float light{i}_innerConeAngle;
            uniform float light{i}_outerConeAngle;
        #endif
    #endif

    // area lights
    #if LIGHT{i}SHAPE != PUNCTUAL

        #define LIT_CODE_FALLOFF_SQUARED // include functionality for inverse squared falloff

        #if LIGHT{i}TYPE == DIRECTIONAL
            uniform vec3 light{i}_position;
        #endif
        uniform vec3 light{i}_halfWidth;
        uniform vec3 light{i}_halfHeight;
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

        // shadowMatrix is not used for omni shadows
        #if LIGHT{i}TYPE != OMNI
            uniform mat4 light{i}_shadowMatrix;
        #endif
        uniform float light{i}_shadowIntensity;
        uniform vec4 light{i}_shadowParams; // width, height, bias, radius

        #if LIGHT{i}SHADOWTYPE == PCSS_32F
            uniform float light{i}_shadowSearchArea;
            uniform vec4 light{i}_cameraParams;
            #if LIGHT{i}TYPE == DIRECTIONAL
                uniform vec4 light{i}_softShadowParams;
            #endif
        #endif

        // directional (cascaded) shadows
        #if LIGHT{i}TYPE == DIRECTIONAL
            uniform mat4 light{i}_shadowMatrixPalette[4];
            uniform vec4 light{i}_shadowCascadeDistances;
            uniform int light{i}_shadowCascadeCount;
            uniform float light{i}_shadowCascadeBlend;
        #endif

        #if LIGHT{i}TYPE == OMNI
            #if defined(LIGHT{i}SHADOW_PCF)
                uniform samplerCubeShadow light{i}_shadowMap;
            #else
                uniform samplerCube light{i}_shadowMap;
            #endif
        #else
            #if defined(LIGHT{i}SHADOW_PCF)
                uniform sampler2DShadow light{i}_shadowMap;
            #else
                uniform sampler2D light{i}_shadowMap;
            #endif
        #endif

    #endif

    // cookie
    #if defined(LIGHT{i}COOKIE)

        #define LIT_CODE_COOKIE // include functionality for cookies

        #if LIGHT{i}TYPE == OMNI
            uniform samplerCube light{i}_cookie;
            uniform float light{i}_cookieIntensity;
            // shadowMatrix needed for cookie cube orientation
            uniform mat4 light{i}_shadowMatrix;
        #endif

        #if LIGHT{i}TYPE == SPOT
            uniform sampler2D light{i}_cookie;
            uniform float light{i}_cookieIntensity;
            #if !defined(LIGHT{i}CASTSHADOW)
                uniform mat4 light{i}_shadowMatrix;
            #endif
            #if defined(LIGHT{i}COOKIE_TRANSFORM)
                uniform vec4 light{i}_cookieMatrix;
                uniform vec2 light{i}_cookieOffset;
            #endif
        #endif
    #endif
#endif
`;
