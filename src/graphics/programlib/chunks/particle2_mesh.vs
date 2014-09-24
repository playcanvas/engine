
	vec3 localPos = particle_vertexData.xyz;
	localPos.xy = Rotate(localPos.xy, angle, rotMatrix);
	localPos.yz = Rotate(localPos.yz, angle, rotMatrix);
	
	Billboard(particlePos, quadXY, localMat);
	
	