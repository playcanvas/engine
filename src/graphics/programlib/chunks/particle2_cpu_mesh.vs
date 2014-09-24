
	worldPos -= localPos;
	localPos = particle_vertexData3.xyz;
	localPos.xy = Rotate(localPos.xy, particle_vertexData2.x, rotMatrix);
	localPos.yz = Rotate(localPos.yz, particle_vertexData2.x, rotMatrix);
	worldPos += localPos;
	