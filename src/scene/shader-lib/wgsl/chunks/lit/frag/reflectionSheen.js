export default /* wgsl */`

fn addReflectionSheen(worldNormal: vec3f, viewDir: vec3f, gloss: f32) {
    let NoV: f32 = dot(worldNormal, viewDir);
    let alphaG: f32 = gloss * gloss;

    // Avoid using a LUT and approximate the values analytically
    let a: f32 = select(
        -8.48 * alphaG + 14.3 * gloss - 9.95,
        -339.2 * alphaG + 161.4 * gloss - 25.9,
        gloss < 0.25
    );
    let b: f32 = select(
        1.97 * alphaG - 3.27 * gloss + 0.72,
        44.0 * alphaG - 23.7 * gloss + 3.26,
        gloss < 0.25
    );
    let dg_add: f32 = select(
        0.1 * ( gloss - 0.25 ),
        0.0,
        gloss < 0.25
    );
    let dg: f32 = exp( a * NoV + b ) + dg_add;
    sReflection = sReflection + (calcReflection(worldNormal, 0.0) * saturate(dg));
}`;
