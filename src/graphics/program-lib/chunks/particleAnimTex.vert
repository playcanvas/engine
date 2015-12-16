
    float atlasX = animFrame * animTexParams.x;
    float atlasY = floor(atlasX) * animTexParams.y;
    atlasX = fract(atlasX);

    texCoordsAlphaLife.xy *= animTexParams.xy;
    texCoordsAlphaLife.xy += vec2(atlasX, atlasY);
    texCoordsAlphaLife.y = 1.0 - texCoordsAlphaLife.y;

