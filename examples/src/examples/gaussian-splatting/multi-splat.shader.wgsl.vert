uniform uTime: f32;

fn modifyPosition(center: vec3f) -> vec3f {
    // modify center
    var result = center;
    let heightIntensity = center.y * 0.2;
    result.x += sin(uniform.uTime * 5.0 + center.y) * 0.3 * heightIntensity;

    // output y-coordinate
    return result;
}

fn modifyColor(center: vec3f, clr: vec4f) -> vec4f {
    var result = clr;
    let sineValue = abs(sin(uniform.uTime * 5.0 + center.y));

    #ifdef CUTOUT
        // in cutout mode, remove pixels along the wave
        if (sineValue < 0.5) {
            result.a = 0.0;
        }
    #else
        // in non-cutout mode, add a golden tint to the wave
        let gold = vec3f(1.0, 0.85, 0.0);
        let blend = smoothstep(0.9, 1.0, sineValue);
        result = vec4f(mix(clr.xyz, gold, blend), clr.a);
    #endif

    return result;
}

