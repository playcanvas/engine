
    rgb *= saturate(gammaCorrectInput(a));
    if ((rgb.r + rgb.g + rgb.b) < 0.000001) discard;

