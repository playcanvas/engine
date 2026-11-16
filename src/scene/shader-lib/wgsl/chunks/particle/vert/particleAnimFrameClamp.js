export default /* wgsl */`
    let animFrame: f32 = min(floor(output.texCoordsAlphaLife.w * uniform.animTexParams.y) + uniform.animTexParams.x, uniform.animTexParams.z);
`;
