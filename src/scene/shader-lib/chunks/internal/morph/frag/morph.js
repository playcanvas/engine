// fragment shader internally used to apply morph targets in textures into a final texture containing
// blended morph targets
export default /* glsl */`

    varying vec2 uv0;

    uniform sampler2DArray morphTexture;
    uniform highp float morphFactor[{MORPH_TEXTURE_MAX_COUNT}];
    uniform highp uint morphIndex[{MORPH_TEXTURE_MAX_COUNT}];
    uniform int count;

    #ifdef MORPH_INT
        uniform vec3 aabbSize;
        uniform vec3 aabbMin;
    #endif

    void main (void) {
        highp vec3 color = vec3(0, 0, 0);

        for (int i = 0; i < count; i++) {
            uint textureIndex = morphIndex[i];
            vec3 delta = texture(morphTexture, vec3(uv0, textureIndex)).xyz;
            color += morphFactor[i] * delta;
        }

        #ifdef MORPH_INT
            color = (color - aabbMin) / aabbSize * 65535.0;
            gl_FragColor = uvec4(color, 1u);
        #else
            gl_FragColor = vec4(color, 1.0);
        #endif
    }
`;
