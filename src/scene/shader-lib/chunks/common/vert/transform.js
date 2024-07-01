export default /* glsl */`
#ifdef PIXELSNAP
uniform vec4 uScreenSize;
#endif

#ifdef SCREENSPACE
uniform float projectionFlipY;
#endif

#ifdef MORPHING_TEXTURE_BASED
    uniform vec2 morph_tex_params;

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

#endif

#ifdef MORPHING_TEXTURE_BASED_POSITION
    #ifdef MORPHING_TEXTURE_BASED_INT
        uniform vec3 aabbSize;
        uniform vec3 aabbMin;
        uniform usampler2D morphPositionTex;
    #else
        uniform highp sampler2D morphPositionTex;
    #endif
#endif

mat4 getModelMatrix() {
    #ifdef DYNAMICBATCH
    return getBoneMatrix(vertex_boneIndices);
    #elif defined(SKIN)
    return matrix_model * getSkinMatrix(vertex_boneIndices, vertex_boneWeights);
    #elif defined(INSTANCING)
    return mat4(instance_line1, instance_line2, instance_line3, instance_line4);
    #else
    return matrix_model;
    #endif
}

vec4 getPosition() {
    dModelMatrix = getModelMatrix();
    vec3 localPos = vertex_position;

    #ifdef NINESLICED
    // outer and inner vertices are at the same position, scale both
    localPos.xz *= outerScale;

    // offset inner vertices inside
    // (original vertices must be in [-1;1] range)
    vec2 positiveUnitOffset = clamp(vertex_position.xz, vec2(0.0), vec2(1.0));
    vec2 negativeUnitOffset = clamp(-vertex_position.xz, vec2(0.0), vec2(1.0));
    localPos.xz += (-positiveUnitOffset * innerOffset.xy + negativeUnitOffset * innerOffset.zw) * vertex_texCoord0.xy;

    vTiledUv = (localPos.xz - outerScale + innerOffset.xy) * -0.5 + 1.0; // uv = local pos - inner corner

    localPos.xz *= -0.5; // move from -1;1 to -0.5;0.5
    localPos = localPos.xzy;
    #endif

    #ifdef MORPHING_TEXTURE_BASED_POSITION

        ivec2 morphUV = getTextureMorphCoords();

        #ifdef MORPHING_TEXTURE_BASED_INT
            vec3 morphPos = vec3(texelFetch(morphPositionTex, ivec2(morphUV), 0).xyz) / 65535.0 * aabbSize + aabbMin;
        #else
            vec3 morphPos = texelFetch(morphPositionTex, ivec2(morphUV), 0).xyz;
        #endif

        localPos += morphPos;

    #endif

    vec4 posW = dModelMatrix * vec4(localPos, 1.0);
    #ifdef SCREENSPACE
    posW.zw = vec2(0.0, 1.0);
    #endif
    dPositionW = posW.xyz;

    vec4 screenPos;
    #ifdef UV1LAYOUT
    screenPos = vec4(vertex_texCoord1.xy * 2.0 - 1.0, 0.5, 1);
        #ifdef WEBGPU
        screenPos.y *= -1.0;
        #endif
    #else
    #ifdef SCREENSPACE
    screenPos = posW;
    screenPos.y *= projectionFlipY;
    #else
    screenPos = matrix_viewProjection * posW;
    #endif

    #ifdef PIXELSNAP
    // snap vertex to a pixel boundary
    screenPos.xy = (screenPos.xy * 0.5) + 0.5;
    screenPos.xy *= uScreenSize.xy;
    screenPos.xy = floor(screenPos.xy);
    screenPos.xy *= uScreenSize.zw;
    screenPos.xy = (screenPos.xy * 2.0) - 1.0;
    #endif
    #endif

    return screenPos;
}

vec3 getWorldPosition() {
    return dPositionW;
}
`;
