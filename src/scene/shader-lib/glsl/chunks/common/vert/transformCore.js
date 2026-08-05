export default /* glsl */`

attribute vec4 vertex_position;

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;

#ifdef MORPHING
    uniform vec2 morph_tex_params;
    attribute uint morph_vertex_id;

    ivec2 getTextureMorphCoords() {

        // turn morph_vertex_id into int grid coordinates
        ivec2 textureSize = ivec2(morph_tex_params);
        int morphGridV = int(morph_vertex_id) / textureSize.x;
        int morphGridU = int(morph_vertex_id) - (morphGridV * textureSize.x);
        #ifdef WEBGPU
            // flipY
            morphGridV = textureSize.y - morphGridV - 1;
        #endif
        return ivec2(morphGridU, morphGridV);
    }

    #ifdef MORPHING_POSITION
        #ifdef MORPHING_INT
            uniform vec3 aabbSize;
            uniform vec3 aabbMin;
            uniform usampler2D morphPositionTex;
        #else
            uniform highp sampler2D morphPositionTex;
        #endif
    #endif
#endif

#ifdef defined(BATCH)
    #include "skinBatchVS"

    mat4 getModelMatrix() {
        return getBoneMatrix(vertex_boneIndices);
    }

#elif defined(SKIN)
    #include "skinVS"

    mat4 getModelMatrix() {
        return matrix_model * getSkinMatrix(vertex_boneIndices, vertex_boneWeights);
    }

#elif defined(INSTANCING)

    #include "transformInstancingVS"

#else

    mat4 getModelMatrix() {
        return matrix_model;
    }

#endif

vec3 getLocalPosition(vec3 vertexPosition) {

    vec3 localPos = vertexPosition;

    #ifdef MORPHING_POSITION

        ivec2 morphUV = getTextureMorphCoords();

        #ifdef MORPHING_INT
            vec3 morphPos = vec3(texelFetch(morphPositionTex, ivec2(morphUV), 0).xyz) / 65535.0 * aabbSize + aabbMin;
        #else
            vec3 morphPos = texelFetch(morphPositionTex, ivec2(morphUV), 0).xyz;
        #endif

        localPos += morphPos;

    #endif

    return localPos;
}

`;
