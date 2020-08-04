    dFogFactor=0.0;
    rgb *= saturate(gammaCorrectInput(max(a, 0.000001)));
    if ((rgb.r + rgb.g + rgb.b) < 0.000001) discard;
