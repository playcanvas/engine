export default /* wgsl */`

fn evaluateFogFactorLinear(depth: f32, fogStart: f32, fogEnd: f32) -> f32 {
    return clamp((fogEnd - depth) / (fogEnd - fogStart), 0.0, 1.0);
}

fn evaluateFogFactorExp(depth: f32, fogDensity: f32) -> f32 {
    return clamp(exp(-depth * fogDensity), 0.0, 1.0);
}

fn evaluateFogFactorExp2(depth: f32, fogDensity: f32) -> f32 {
    return clamp(exp(-depth * depth * fogDensity * fogDensity), 0.0, 1.0);
}
`;
