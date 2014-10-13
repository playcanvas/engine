
    worldPos -= localPos;
    localPos = particle_vertexData3.xyz;
    localPos.xy = rotate(localPos.xy, particle_vertexData2.x, rotMatrix);
    localPos.yz = rotate(localPos.yz, particle_vertexData2.x, rotMatrix);
    worldPos += localPos;

