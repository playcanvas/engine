export default /* wgsl */`
uniform exposure: f32;

fn toneMap(color: vec3f) -> vec3f {
    let A: f32 = 0.22;
    let B: f32 = 0.3;
    let C: f32 = 0.1;
    let D: f32 = 0.2;
    let E: f32 = 0.01;
    let F: f32 = 0.3;
    let Scl: f32 = 1.25;

    let adjusted_color = color * uniform.exposure;
    let h = max(vec3f(0.0), adjusted_color - vec3f(0.004));

    return (h * ((Scl * A) * h + Scl * vec3f(C * B)) + Scl * vec3f(D * E)) /
           (h * (A * h + vec3f(B)) + vec3f(D * F)) -
           Scl * vec3f(E / F);
}
`;
