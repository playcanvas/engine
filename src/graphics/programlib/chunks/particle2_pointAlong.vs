    vec4 mm = matrix_viewProjection * vec4(particleVelocity, 1.0);
    mm.xy = normalize(mm.xy);
    angle = atan(mm.x, mm.y); // not the fastest way, but easier to plug in; TODO: create rot matrix right from vectors

