export default /* wgsl */`
    let tileMask: vec2f = step(vMask, vec2f(0.99999));
    let tileSize: vec2f = 0.5 * (uniform.innerOffset.xy + uniform.innerOffset.zw);
    let tileScale: vec2f = vec2f(1.0) / (vec2f(1.0) - tileSize);
    var clampedUv: vec2f = mix(uniform.innerOffset.xy * 0.5, vec2f(1.0) - uniform.innerOffset.zw * 0.5, fract((vTiledUv - tileSize) * tileScale));
    clampedUv = clampedUv * uniform.atlasRect.zw + uniform.atlasRect.xy;
    nineSlicedUv = vUv0 * tileMask + clampedUv * (vec2f(1.0) - tileMask);
    nineSlicedUv.y = 1.0 - nineSlicedUv.y;

`;
