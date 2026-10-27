export default /* wgsl */`

fn addReflectionSheen(worldNormal: vec3f, viewDir: vec3f, gloss: f32) {
    let NoV: f32 = dot(worldNormal, viewDir);
    let roughness: f32 = 1.0 - gloss;
    let alphaG: f32 = roughness * roughness;

    // Avoid using a LUT and approximate the values analytically, as a function of the roughness
    let a: f32 = select(
        -8.48 * alphaG + 14.3 * roughness - 9.95,
        -339.2 * alphaG + 161.4 * roughness - 25.9,
        roughness < 0.25
    );
    let b: f32 = select(
        1.97 * alphaG - 3.27 * roughness + 0.72,
        44.0 * alphaG - 23.7 * roughness + 3.26,
        roughness < 0.25
    );
    let dg_add: f32 = select(
        0.1 * ( roughness - 0.25 ),
        0.0,
        roughness < 0.25
    );
    let dg: f32 = exp( a * NoV + b ) + dg_add;
    sReflection = sReflection + (calcReflection(worldNormal, 0.0) * saturate(dg));
}`;
