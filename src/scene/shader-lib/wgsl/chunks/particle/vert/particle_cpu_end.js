export default /* wgsl */`
    localPos = localPos * input.particle_vertexData2.y * uniform.emitterScale;

    #ifdef SCREEN_SPACE
        // clip space spans the viewport width in x and its height in y, so scale the offset x by
        // height / width to keep the particle square, sized relative to the viewport height
        localPos.x *= uniform.viewport_size.y * uniform.viewport_size.z;
    #endif

    localPos = localPos + particlePos;

    #ifdef SCREEN_SPACE
        output.position = vec4f(localPos.x, localPos.y, 0.0, 1.0);
    #else
        output.position = uniform.matrix_viewProjection * vec4f(localPos, 1.0);
    #endif
`;
