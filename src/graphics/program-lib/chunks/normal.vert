#ifdef MORPHING_TEXTURE_BASED_NORMAL
    uniform highp sampler2D morphNormalTex;
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

    #ifdef MORPHING
        #ifdef MORPHING_NRM03
            tempNormal += morph_weights_a[0] * morph_nrm0;
            tempNormal += morph_weights_a[1] * morph_nrm1;
            tempNormal += morph_weights_a[2] * morph_nrm2;
            tempNormal += morph_weights_a[3] * morph_nrm3;
        #endif
        #ifdef MORPHING_NRM47
            tempNormal += morph_weights_b[0] * morph_nrm4;
            tempNormal += morph_weights_b[1] * morph_nrm5;
            tempNormal += morph_weights_b[2] * morph_nrm6;
            tempNormal += morph_weights_b[3] * morph_nrm7;
        #endif
    #endif

    #ifdef MORPHING_TEXTURE_BASED_NORMAL
        // apply morph offset from texture
        vec2 morphUV = getTextureMorphCoords();
        vec3 morphNormal = texture2D(morphNormalTex, morphUV).xyz;
        tempNormal += morphNormal;
    #endif

    return normalize(dNormalMatrix * tempNormal);
}

