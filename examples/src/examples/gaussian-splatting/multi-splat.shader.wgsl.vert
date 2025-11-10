uniform uTime: f32;

fn modifyCenter(center: ptr<function, vec3f>) {
    // modify center
    let heightIntensity = (*center).y * 0.2;
    (*center).x += sin(uniform.uTime * 5.0 + (*center).y) * 0.3 * heightIntensity;
}

fn modifyCovariance(originalCenter: vec3f, modifiedCenter: vec3f, covA: ptr<function, vec3f>, covB: ptr<function, vec3f>) {
    // no modification
}

fn modifyColor(center: vec3f, clr: ptr<function, vec4f>) {
    let sineValue = abs(sin(uniform.uTime * 5.0 + center.y));

    #ifdef CUTOUT
        // in cutout mode, remove pixels along the wave
        if (sineValue < 0.5) {
            (*clr).a = 0.0;
        }
    #else
        // in non-cutout mode, add a golden tint to the wave
        let gold = vec3f(1.0, 0.85, 0.0);
        let blend = smoothstep(0.9, 1.0, sineValue);
        (*clr) = vec4f(mix((*clr).xyz, gold, blend), (*clr).a);
    #endif
}

