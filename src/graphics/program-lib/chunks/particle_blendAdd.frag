    d_fog_factor=0.0; //for additive blend, this should be 0.0
    rgb *= saturate(gammaCorrectInput(a));
    if ((rgb.r + rgb.g + rgb.b) < 0.000001) discard;
