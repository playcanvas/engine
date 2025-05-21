export default /* wgsl */`
fn getFalloffWindow(lightRadius: f32, lightDir: vec3f) -> f32 {
    let sqrDist: f32 = dot(lightDir, lightDir);
    let invRadius: f32 = 1.0 / lightRadius;
    return square(saturate(1.0 - square(sqrDist * square(invRadius))));
}

fn getFalloffInvSquared(lightRadius: f32, lightDir: vec3f) -> f32 {
    let sqrDist: f32 = dot(lightDir, lightDir);
    var falloff: f32 = 1.0 / (sqrDist + 1.0);
    let invRadius: f32 = 1.0 / lightRadius;

    falloff = falloff * 16.0;
    falloff = falloff * square(saturate(1.0 - square(sqrDist * square(invRadius))));

    return falloff;
}
`;
