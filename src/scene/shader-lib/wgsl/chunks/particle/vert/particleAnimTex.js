export default /* wgsl */`
    var animationIndex: f32;

    if (uniform.animTexIndexParams.y == 1.0) {
        animationIndex = floor((uniform.animTexParams.w + 1.0) * rndFactor3.z) * (uniform.animTexParams.z + 1.0);
    } else {
        animationIndex = uniform.animTexIndexParams.x * (uniform.animTexParams.z + 1.0);
    }

    var atlasX: f32 = (animationIndex + animFrame) * uniform.animTexTilesParams.x;
    let atlasY: f32 = 1.0 - floor(atlasX + 1.0) * uniform.animTexTilesParams.y;
    atlasX = fract(atlasX); // Reassign atlasX

    let current_tcal_xy = output.texCoordsAlphaLife.xy;
    let scaled_tcal_xy = current_tcal_xy * uniform.animTexTilesParams.xy;
    let final_tcal_xy = scaled_tcal_xy + vec2f(atlasX, atlasY);
    output.texCoordsAlphaLife = vec4f(final_tcal_xy, output.texCoordsAlphaLife.z, output.texCoordsAlphaLife.w);
`;
