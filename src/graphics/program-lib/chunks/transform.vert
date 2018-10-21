#ifdef PIXELSNAP
    uniform vec4 uScreenSize;
#endif

mat4 getModelMatrix() {
    #ifdef DYNAMICBATCH
        return getBoneMatrix(vertex_boneIndices);
    #elif defined(SKIN)
        return matrix_model * (getBoneMatrix(vertex_boneIndices.x) * vertex_boneWeights.x +
               getBoneMatrix(vertex_boneIndices.y) * vertex_boneWeights.y +
               getBoneMatrix(vertex_boneIndices.z) * vertex_boneWeights.z +
               getBoneMatrix(vertex_boneIndices.w) * vertex_boneWeights.w);
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

    vec4 posW = dModelMatrix * vec4(localPos, 1.0);
    #ifdef SCREENSPACE
        posW.zw = vec2(0.0, 1.0);
    #endif
    dPositionW = posW.xyz;

    vec4 screenPos;
    #ifdef UV1LAYOUT
        screenPos = vec4(vertex_texCoord1.xy * 2.0 - 1.0, 0.5, 1);
    #else
        #ifdef SCREENSPACE
            screenPos = posW;
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
