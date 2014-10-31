
    life = clamp(life - graphSampleSize * stretch, 0.0, 1.0);
    vec3 localOffsetPast =     tex1Dlod_lerp(internalTex0, vec2(life, 0), paramDivergence).xyz;
    vec3 worldOffsetPast =    tex1Dlod_lerp(internalTex1, vec2(life, 0), posDivergence).xyz;
    tex1Dlod_lerp(internalTex2, vec2(life, 0), posWorldDivergence);

    divergentLocalOffset =     mix(localOffsetPast.xyz, -localOffsetPast.xyz, rndFactor3);
    localOffsetPast.xyz =     mix(localOffsetPast.xyz, divergentLocalOffset, posDivergence);

    divergentWorldOffset =     mix(worldOffsetPast.xyz, -worldOffsetPast.xyz, rndFactor3);
    worldOffsetPast.xyz =     mix(worldOffsetPast.xyz, divergentWorldOffset, posWorldDivergence);

    vec3 particlePosPast = sourcePos + mat3(matrix_model) * localOffsetPast.xyz + worldOffsetPast.xyz * emitterScale;
    particlePosPast += particlePosMoved;

    //vec3 moveDir = particlePos - particlePosPast;
    //float sgn = (moveDir.x>0.0? 1.0 : -1.0) * (moveDir.y>0.0? 1.0 : -1.0) * (moveDir.z>0.0? 1.0 : -1.0);

    float interpolation =  quadXY.y * 0.5 + 0.5;
    particlePos = mix(particlePos, particlePosPast, interpolation);



