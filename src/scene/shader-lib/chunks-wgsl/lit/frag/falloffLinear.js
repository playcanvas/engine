export default /* wgsl */`
fn getFalloffLinear(lightRadius: f32, lightDir: vec3f) -> f32 {
    let d: f32 = length(lightDir);
    return max(((lightRadius - d) / lightRadius), 0.0);
}
`;
