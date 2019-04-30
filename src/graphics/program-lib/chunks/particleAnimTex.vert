
    float atlasX = animFrame * animTexParams.x;
    float atlasY = 1.0 - floor(atlasX + 1.0) * animTexParams.y;
    atlasX = fract(atlasX);

    texCoordsAlphaLife.xy *= animTexParams.xy;
    texCoordsAlphaLife.xy += vec2(atlasX, atlasY);

