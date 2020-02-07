
    float atlasX = (animFrame + animTexParams.x) * animTexTilesParams.x;
    float atlasY = 1.0 - floor(atlasX + 1.0) * animTexTilesParams.y;
    atlasX = fract(atlasX);

    texCoordsAlphaLife.xy *= animTexTilesParams.xy;
    texCoordsAlphaLife.xy += vec2(atlasX, atlasY);

