export default /* wgsl */`
    let rot3 = mat3x3f(
        vec3f(rotMatrix[0][0], rotMatrix[1][0], 0.0),
        vec3f(rotMatrix[0][1], rotMatrix[1][1], 0.0),
        vec3f(0.0, 0.0, 1.0)
    );

    let viewBasis = mat3x3f(
        -uniform.matrix_viewInverse[0].xyz,
        -uniform.matrix_viewInverse[1].xyz,
        uniform.matrix_viewInverse[2].xyz
    );

    let tempMat = viewBasis * rot3;

    // WGSL does not support matrix varyings, decompose it to vec3s
    output.ParticleMat0 = tempMat[0];
    output.ParticleMat1 = tempMat[1];
    output.ParticleMat2 = tempMat[2];
`;
