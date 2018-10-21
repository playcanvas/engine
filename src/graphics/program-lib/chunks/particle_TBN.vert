
    mat3 rot3 = mat3(rotMatrix[0][0], rotMatrix[0][1], 0.0,        rotMatrix[1][0], rotMatrix[1][1], 0.0,        0.0, 0.0, 1.0);
    ParticleMat = mat3(-matrix_viewInverse[0].xyz, -matrix_viewInverse[1].xyz, matrix_viewInverse[2].xyz) * rot3;

