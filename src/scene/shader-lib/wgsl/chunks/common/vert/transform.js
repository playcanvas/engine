export default /* wgsl */`
#ifdef PIXELSNAP
    uniform uScreenSize: vec4f;
#endif

#ifdef SCREENSPACE
    uniform projectionFlipY: f32;
#endif

fn evalWorldPosition(vertexPosition: vec3f, modelMatrix: mat4x4f) -> vec4f {

    var localPos: vec3f = getLocalPosition(vertexPosition);

    #ifdef NINESLICED
        // outer and inner vertices are at the same position, scale both
        var localPosXZ: vec2f = localPos.xz;
        localPosXZ = localPosXZ * uniform.outerScale;

        // offset inner vertices inside
        // (original vertices must be in [-1;1] range)
        let positiveUnitOffset: vec2f = clamp(vertexPosition.xz, vec2f(0.0), vec2f(1.0));
        let negativeUnitOffset: vec2f = clamp(-vertexPosition.xz, vec2f(0.0), vec2f(1.0));
        localPosXZ = localPosXZ + (-positiveUnitOffset * uniform.innerOffset.xy + negativeUnitOffset * uniform.innerOffset.zw) * vertex_texCoord0.xy;

        dTiledUvGlobal = (localPosXZ - uniform.outerScale + uniform.innerOffset.xy) * -0.5 + 1.0; // uv = local pos - inner corner

        localPosXZ = localPosXZ * -0.5;
        localPos = vec3f(localPosXZ.x, localPosXZ.y, localPos.y);
    #endif

    var posW: vec4f = modelMatrix * vec4f(localPos, 1.0);

    #ifdef SCREENSPACE
        posW = vec4f(posW.xy, 0.0, 1.0);
    #endif

    return posW;
}

fn getPosition() -> vec4f {

    dModelMatrix = getModelMatrix();

    let posW: vec4f = evalWorldPosition(vertex_position.xyz, dModelMatrix);
    dPositionW = posW.xyz;

    var screenPos: vec4f;
    #ifdef UV1LAYOUT
        screenPos = vec4f(vertex_texCoord1.xy * 2.0 - 1.0, 0.5, 1.0);
        screenPos.y *= -1.0;
    #else
        #ifdef SCREENSPACE
            screenPos = posW;
            screenPos.y *= uniform.projectionFlipY;
        #else
            screenPos = uniform.matrix_viewProjection * posW;
        #endif

        #ifdef PIXELSNAP
            // snap vertex to a pixel boundary
            screenPos.xy = (screenPos.xy * 0.5) + 0.5;
            screenPos.xy *= uniforms.uScreenSize.xy;
            screenPos.xy = floor(screenPos.xy);
            screenPos.xy *= uniforms.uScreenSize.zw;
            screenPos.xy = (screenPos.xy * 2.0) - 1.0;
        #endif
    #endif

    return screenPos;
}

fn getWorldPosition() -> vec3f {
    return dPositionW;
}
`;
