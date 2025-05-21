export default /* glsl */`

attribute vec3 vertex_normal;

#ifdef MORPHING_NORMAL
    #ifdef MORPHING_INT
        uniform highp usampler2D morphNormalTex;
    #else
        uniform highp sampler2D morphNormalTex;
    #endif
#endif

vec3 getLocalNormal(vec3 vertexNormal) {

    vec3 localNormal = vertex_normal;

    #ifdef MORPHING_NORMAL

        ivec2 morphUV = getTextureMorphCoords();

        #ifdef MORPHING_INT
            vec3 morphNormal = vec3(texelFetch(morphNormalTex, ivec2(morphUV), 0).xyz) / 65535.0 * 2.0 - 1.0;
        #else
            vec3 morphNormal = texelFetch(morphNormalTex, ivec2(morphUV), 0).xyz;
        #endif

        localNormal += morphNormal;

    #endif

    return localNormal;
}

#ifdef SKIN
    mat3 getNormalMatrix(mat4 modelMatrix) {
        return mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz);
    }
#elif defined(INSTANCING)
    mat3 getNormalMatrix(mat4 modelMatrix) {
        return mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz);
    }
#else
    mat3 getNormalMatrix(mat4 modelMatrix) {
        return matrix_normal;
    }
#endif
`;
