export default /* glsl */`
#ifdef MORPHING_TEXTURE_BASED_NORMAL
    #ifdef MORPHING_TEXTURE_BASED_INT
        uniform highp usampler2D morphNormalTex;
    #else
        uniform highp sampler2D morphNormalTex;
    #endif
#endif

vec3 getNormal() {
    #ifdef SKIN
    dNormalMatrix = mat3(dModelMatrix[0].xyz, dModelMatrix[1].xyz, dModelMatrix[2].xyz);
    #elif defined(INSTANCING)
    dNormalMatrix = mat3(instance_line1.xyz, instance_line2.xyz, instance_line3.xyz);
    #else
    dNormalMatrix = matrix_normal;
    #endif

    vec3 tempNormal = vertex_normal;

    #ifdef MORPHING_TEXTURE_BASED_NORMAL

        ivec2 morphUV = getTextureMorphCoords();

        #ifdef MORPHING_TEXTURE_BASED_INT
            vec3 morphNormal = vec3(texelFetch(morphNormalTex, ivec2(morphUV), 0).xyz) / 65535.0 * 2.0 - 1.0;
        #else
            vec3 morphNormal = texelFetch(morphNormalTex, ivec2(morphUV), 0).xyz;
        #endif

         tempNormal += morphNormal;

    #endif

    return normalize(dNormalMatrix * tempNormal);
}
`;
