export default /* wgsl */`
const A: f32 = 0.15;
const B: f32 = 0.50;
const C: f32 = 0.10;
const D: f32 = 0.20;
const E: f32 = 0.02;
const F: f32 = 0.30;
const W: f32 = 11.2;

uniform exposure: f32;

fn uncharted2Tonemap(x: vec3f) -> vec3f {
    return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - vec3f(E / F);
}

fn toneMap(color: vec3f) -> vec3f {
    var c: vec3f = uncharted2Tonemap(color * uniform.exposure);
    let whiteScale: vec3f = vec3f(1.0) / uncharted2Tonemap(vec3f(W, W, W));
    c *= whiteScale;
    return c;
}
`;
