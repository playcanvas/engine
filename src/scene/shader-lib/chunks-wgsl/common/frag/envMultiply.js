export default /* wgsl */`
uniform skyboxIntensity : f32;

fn processEnvironment(color : vec3f) -> vec3f {
    return color * uniform.skyboxIntensity;
}
`;
