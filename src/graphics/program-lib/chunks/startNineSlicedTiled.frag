    UMEDP vec2 tileMask = step(vMask, vec2(0.99999));
    UMEDP vec2 tileSize = 0.5 * (innerOffset.xy + innerOffset.zw);
    UMEDP vec2 tileScale = vec2(1.0) / (vec2(1.0) - tileSize);
    UMEDP vec2 clampedUv = mix(innerOffset.xy * 0.5, vec2(1.0) - innerOffset.zw * 0.5, fract((vTiledUv - tileSize) * tileScale));
    clampedUv = clampedUv * atlasRect.zw + atlasRect.xy;
    nineSlicedUv = vUv0 * tileMask + clampedUv * (vec2(1.0) - tileMask);
