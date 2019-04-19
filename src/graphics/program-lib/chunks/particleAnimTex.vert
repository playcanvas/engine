
    float atlasX = animFrame * animTexParams.x;
    float atlasY = 1.0 - floor(atlasX) * animTexParams.y;
    atlasX = fract(atlasX);

    texCoordsAlphaLife.xy *= animTexParams.xy;
    texCoordsAlphaLife.xy += vec2(atlasX, atlasY);

