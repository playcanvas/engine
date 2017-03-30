
    quadXY = rotate(quadXY, inAngle, rotMatrix);
    vec3 localPos = billboard_perspective(particlePos, quadXY, localMat);

