
    life = max(life - graphSampleSize*stretch, 0.0);
    vec3 localOffsetPast =     tex1Dlod_lerp(internalTex0, vec2(life, 0), paramDivergence).xyz;
    vec3 worldOffsetPast =    tex1Dlod_lerp(internalTex1, vec2(life, 0), posDivergence).xyz;

    divergentLocalOffset =     mix(localOffsetPast.xyz, -localOffsetPast.xyz, rndFactor3);
    localOffsetPast.xyz =     mix(localOffsetPast.xyz, divergentLocalOffset, posDivergence);

    divergentWorldOffset =     mix(worldOffsetPast.xyz, -worldOffsetPast.xyz, rndFactor3);
    worldOffsetPast.xyz =     mix(worldOffsetPast.xyz, divergentWorldOffset, posWorldDivergence);

    vec3 particlePosPast = sourcePos + matrix_normal * localOffsetPast.xyz   +   worldOffsetPast.xyz;
    particlePosPast += particlePosMoved;

    vec3 moveDir = particlePos - particlePosPast;
    float sgn = (moveDir.x>0.0? 1.0 : -1.0) * (moveDir.y>0.0? 1.0 : -1.0) * (moveDir.z>0.0? 1.0 : -1.0);

    //localPos *= abs(moveDir * vec3(10.0)) ;//+ vec3(1.0);

    float interpolation =  quadXY.y*0.5+0.5;
    particlePos = sgn>0.0? mix(particlePosPast, particlePos, interpolation) : mix(particlePos, particlePosPast, interpolation);

    //vec3 pastLocal = billboard(particlePosPast, quadXY, localMat);
    //localPos = sgn>0.0? mix(pastLocal, localPos, interpolation) : mix(localPos, pastLocal, interpolation);


