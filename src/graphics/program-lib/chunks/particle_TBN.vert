
    mat3 rot3 = mat3(rotMatrix[0][0], rotMatrix[0][1], 0.0,        rotMatrix[1][0], rotMatrix[1][1], 0.0,        0.0, 0.0, 1.0);
    localMat[2] *= -1.0;
    ParticleMat = localMat * rot3;




