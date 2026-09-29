export default /* wgsl */`
uniform view_position: vec3f;

uniform light_globalAmbient: vec3f;

fn square(x: f32) -> f32 {
    return x*x;
}
`;
