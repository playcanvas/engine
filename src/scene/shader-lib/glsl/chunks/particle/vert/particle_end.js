export default /* glsl */`
    localPos *= scale * emitterScale;

    #ifdef SCREEN_SPACE
        // clip space spans the viewport width in x and its height in y, so scale the offset x by
        // height / width to keep the particle square, sized relative to the viewport height
        localPos.x *= viewport_size.y * viewport_size.z;
    #endif

    localPos += particlePos;

    #ifdef SCREEN_SPACE
    gl_Position = vec4(localPos.x, localPos.y, 0.0, 1.0);
    #else
    gl_Position = matrix_viewProjection * vec4(localPos.xyz, 1.0);
    #endif
`;
