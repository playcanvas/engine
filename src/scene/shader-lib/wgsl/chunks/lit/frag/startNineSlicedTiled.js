export default /* wgsl */`
    let tileMask: vec2f = step(vMask, vec2f(0.99999));
    let tileSize: vec2f = 0.5 * (uniform.innerOffset.xy + uniform.innerOffset.zw);
    let tileScale: vec2f = vec2f(1.0) / (vec2f(1.0) - tileSize);
    // position within the repeating tile, kept half a texel inside it: at a seam the wrap lands
    // within a hair of the tile's edge, which sampling can round onto the texel beyond - the
    // frame's own border, or the next frame in the atlas
    let tileUv: vec2f = clamp(fract((vTiledUv - tileSize) * tileScale), uniform.tileHalfTexel, vec2f(1.0) - uniform.tileHalfTexel);
    var clampedUv: vec2f = mix(uniform.innerOffset.xy * 0.5, vec2f(1.0) - uniform.innerOffset.zw * 0.5, tileUv);
    clampedUv = clampedUv * uniform.atlasRect.zw + uniform.atlasRect.xy;
    nineSlicedUv = vUv0 * tileMask + clampedUv * (vec2f(1.0) - tileMask);
    nineSlicedUv.y = 1.0 - nineSlicedUv.y;

`;
