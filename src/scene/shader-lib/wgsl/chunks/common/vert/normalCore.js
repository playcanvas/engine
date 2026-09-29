export default /* wgsl */`

attribute vertex_normal: vec3f;

#ifdef MORPHING_NORMAL
    #ifdef MORPHING_INT
        var morphNormalTex: texture_2d<u32>;
        var morphNormalTexSampler: sampler;
    #else
        var morphNormalTex: texture_2d<f32>;
        var morphNormalTexSampler: sampler;
    #endif
#endif

fn getLocalNormal(vertexNormal: vec3f) -> vec3f {

    var localNormal: vec3f = vertexNormal;

    #ifdef MORPHING_NORMAL

        let morphUV: vec2i = getTextureMorphCoords();

        #ifdef MORPHING_INT
            let morphNormalInt: vec4u = textureLoad(morphNormalTex, morphUV, 0);
            let morphNormalF: vec3f = vec3f(morphNormalInt.xyz) / 65535.0 * 2.0 - 1.0;
            localNormal = localNormal + morphNormalF;
        #else
            let morphNormal: vec3f = textureLoad(morphNormalTex, morphUV, 0).xyz;
            localNormal = localNormal + morphNormal;
        #endif

    #endif

    return localNormal;
}

// the normal matrix is the upper 3x3 of the model matrix, exact for a uniform scale, for skinned, batched
// and instanced meshes, which have no normal matrix of their own, and in the shadow pass, which sets none
#if defined(SKIN) || defined(BATCH) || defined(INSTANCING) || defined(SHADOW_PASS)
    fn getNormalMatrix(modelMatrix: mat4x4f) -> mat3x3f {
        return mat3x3f(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz);
    }
#else
    uniform matrix_normal: mat3x3f;

    fn getNormalMatrix(modelMatrix: mat4x4f) -> mat3x3f {
        return uniform.matrix_normal;
    }
#endif
`;
