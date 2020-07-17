    float animationIndex;

    if (animTexIndexParams.y == 1.0) {
        animationIndex = floor((animTexParams.w + 1.0) * rndFactor3.z) * (animTexParams.z + 1.0);
    } else {
        animationIndex = animTexIndexParams.x * (animTexParams.z + 1.0);
    }

    float atlasX = (animationIndex + animFrame) * animTexTilesParams.x;
    float atlasY = 1.0 - floor(atlasX + 1.0) * animTexTilesParams.y;
    atlasX = fract(atlasX);

    texCoordsAlphaLife.xy *= animTexTilesParams.xy;
    texCoordsAlphaLife.xy += vec2(atlasX, atlasY);
