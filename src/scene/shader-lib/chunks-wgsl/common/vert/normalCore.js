export default /* glsl */`

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

        // Assuming getTextureMorphCoords() returns vec2i
        let morphUV: vec2i = getTextureMorphCoords();

        #ifdef MORPHING_INT
            // Use textureLoad (texelFetch equivalent), requires integer coordinates and returns vec4u
            let morphNormalInt: vec4u = textureLoad(morphNormalTex, morphUV, 0);
            // Convert unsigned int vector components to float vector for calculations
            let morphNormalF: vec3f = vec3f(morphNormalInt.xyz) / 65535.0 * 2.0 - 1.0;
            localNormal = localNormal + morphNormalF; // Expand +=
        #else
            // Use textureLoad, requires integer coordinates and returns vec4f
            let morphNormal: vec3f = textureLoad(morphNormalTex, morphUV, 0).xyz;
            localNormal = localNormal + morphNormal; // Expand +=
        #endif

    #endif

    return localNormal;
}

#ifdef SKIN
    fn getNormalMatrix(modelMatrix: mat4x4f) -> mat3x3f {
        // Construct mat3x3f from columns' xyz components
        return mat3x3f(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz);
    }
#elif defined(INSTANCING)
    fn getNormalMatrix(modelMatrix: mat4x4f) -> mat3x3f {
        // Construct mat3x3f from columns' xyz components
        return mat3x3f(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz);
    }
#else
    fn getNormalMatrix(modelMatrix: mat4x4f) -> mat3x3f {
        // Access uniform via uniform.<name>
        return uniform.matrix_normal;
    }
#endif
`;
