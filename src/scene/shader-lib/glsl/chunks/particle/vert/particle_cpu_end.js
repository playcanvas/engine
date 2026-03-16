export default /* glsl */`
    localPos *= particle_vertexData2.y * emitterScale;
    localPos += particlePos;

    #ifdef SCREEN_SPACE
    gl_Position = vec4(localPos.x, localPos.y, 0.0, 1.0);
    #else
    gl_Position = matrix_viewProjection * vec4(localPos, 1.0);
    #endif
`;
