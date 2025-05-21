export default /* wgsl */`
fn readInput(uv: f32) {
    let tex: vec4f = textureSampleLevel(particleTexIN, particleTexINSampler, vec2f(uv, 0.25), 0.0);
    let tex2: vec4f = textureSampleLevel(particleTexIN, particleTexINSampler, vec2f(uv, 0.75), 0.0);

    inPos = tex.xyz;
    inVel = tex2.xyz;
    inAngle = abs(tex.w) - 1000.0;
    inShow = tex.w >= 0.0;
    inLife = tex2.w;
}
`;
