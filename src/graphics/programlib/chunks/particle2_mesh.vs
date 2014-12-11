
    vec3 localPos = meshLocalPos;
    localPos.xy = rotate(localPos.xy, angle, rotMatrix);
    localPos.yz = rotate(localPos.yz, angle, rotMatrix);

    billboard(particlePos, quadXY, localMat);


