export default /* wgsl */`

    attribute vertex_position: vec4f;

    uniform matrix_viewProjection: mat4x4f;
    uniform matrix_model: mat4x4f;
    uniform matrix_normal: mat3x3f;

    #ifdef MORPHING

        uniform morph_tex_params: vec2f;
        attribute morph_vertex_id: u32;

        fn getTextureMorphCoords() -> vec2i {

            // turn morph_vertex_id into int grid coordinates
            var textureSize: vec2i = vec2i(uniform.morph_tex_params);
            var morphGridV: i32 = i32(morph_vertex_id) / textureSize.x;
            var morphGridU: i32 = i32(morph_vertex_id) - (morphGridV * textureSize.x);
            morphGridV = textureSize.y - morphGridV - 1;
            return vec2i(morphGridU, morphGridV);
        }

        #ifdef MORPHING_POSITION
            #ifdef MORPHING_INT
                uniform aabbSize: vec3f;
                uniform aabbMin: vec3f;
                var morphPositionTex: texture_2d<u32>;
            #else
                var morphPositionTex: texture_2d<f32>;
            #endif
        #endif
    #endif

    #ifdef defined(BATCH)
        #include "skinBatchVS"

        fn getModelMatrix() -> mat4x4f {
            return getBoneMatrix(vertex_boneIndices);
        }

    #elif defined(SKIN)
        #include "skinVS"
        fn getModelMatrix() -> mat4x4f {
            return uniform.matrix_model * getSkinMatrix(vertex_boneIndices, vertex_boneWeights);
        }

    #elif defined(INSTANCING)

        #include "transformInstancingVS"

    #else

        fn getModelMatrix() -> mat4x4f {
            return uniform.matrix_model;
        }

    #endif

    fn getLocalPosition(vertexPosition: vec3f) -> vec3f {

        var localPos: vec3f = vertexPosition;

        #ifdef MORPHING_POSITION

            var morphUV: vec2i = getTextureMorphCoords();

            #ifdef MORPHING_INT
                // Use textureLoad instead of texelFetch. Coordinates must be integer type (vec2i).
                // WGSL requires explicit type conversion for vectors.
                // Division by float literal ensures floating point division.
                var morphPos: vec3f = vec3f(textureLoad(morphPositionTex, morphUV, 0).xyz) / 65535.0 * uniform.aabbSize + uniform.aabbMin;
            #else
                // Use textureLoad instead of texelFetch. Coordinates must be integer type (vec2i).
                var morphPos: vec3f = textureLoad(morphPositionTex, morphUV, 0).xyz;
            #endif

            localPos += morphPos;

        #endif

        return localPos;
    }
`;
