export default /* wgsl */`
uniform view_position: vec3f;

uniform light_globalAmbient: vec3f;

fn square(x: f32) -> f32 {
    return x*x;
}

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn saturate3(x: vec3f) -> vec3f {
    return clamp(x, vec3f(0.0), vec3f(1.0));
}
`;
