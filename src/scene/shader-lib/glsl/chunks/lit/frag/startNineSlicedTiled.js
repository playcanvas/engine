export default /* glsl */`
    vec2 tileMask = step(vMask, vec2(0.99999));
    vec2 tileSize = 0.5 * (innerOffset.xy + innerOffset.zw);
    vec2 tileScale = vec2(1.0) / (vec2(1.0) - tileSize);
    // position within the repeating tile, inset by tileHalfTexel for nearest sampling (see setTileHalfTexel)
    vec2 tileUv = clamp(fract((vTiledUv - tileSize) * tileScale), tileHalfTexel, vec2(1.0) - tileHalfTexel);
    vec2 clampedUv = mix(innerOffset.xy * 0.5, vec2(1.0) - innerOffset.zw * 0.5, tileUv);
    clampedUv = clampedUv * atlasRect.zw + atlasRect.xy;
    nineSlicedUv = vUv0 * tileMask + clampedUv * (vec2(1.0) - tileMask);
    nineSlicedUv.y = 1.0 - nineSlicedUv.y;
    
`;
