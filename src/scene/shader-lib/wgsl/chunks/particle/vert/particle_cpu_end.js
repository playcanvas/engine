export default /* wgsl */`
    localPos = localPos * input.particle_vertexData2.y * emitterScale;
    localPos = localPos + particlePos;

    output.position = uniform.matrix_viewProjection * vec4f(localPos, 1.0);
`;
