
    vec3 localPos = particle_vertexData.xyz;
    localPos.xy = rotate(localPos.xy, angle, rotMatrix);
    localPos.yz = rotate(localPos.yz, angle, rotMatrix);

    billboard(particlePos, quadXY, localMat);


