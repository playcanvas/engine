
    vec2 tileMask = step(vMask, vec2(0.99999));
    vec2 clampedUv = mix(innerOffset.xy*0.5, vec2(1.0) - innerOffset.zw*0.5, fract(vTiledUv));
    clampedUv = clampedUv * atlasRect.zw + atlasRect.xy;
    nineSlicedUv = vUv0 * tileMask + clampedUv * (vec2(1.0) - tileMask);

