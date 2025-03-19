// fragment shader internally used to apply morph targets in textures into a final texture containing
// blended morph targets
export default /* glsl */`

    varying vec2 uv0;

    // LOOP - source morph target textures
    #include "morphDeclarationPS, MORPH_TEXTURE_COUNT"

    #if MORPH_TEXTURE_COUNT > 0
        uniform highp float morphFactor[{MORPH_TEXTURE_COUNT}];
    #endif

    #ifdef MORPH_INT
        uniform vec3 aabbSize;
        uniform vec3 aabbMin;
    #endif

    void main (void) {
        highp vec4 color = vec4(0, 0, 0, 1);

        // LOOP - source morph target textures
        #include "morphEvaluationPS, MORPH_TEXTURE_COUNT"

        #ifdef MORPH_INT
            color.xyz = (color.xyz - aabbMin) / aabbSize * 65535.0;
            gl_FragColor = uvec4(color);
        #else
            gl_FragColor = color;
        #endif
    }
`;
