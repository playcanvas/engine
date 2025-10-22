uniform float uTime;

void modifyCenter(inout vec3 center) {
    // modify center
    float heightIntensity = center.y * 0.2;
    center.x += sin(uTime * 5.0 + center.y) * 0.3 * heightIntensity;
}

void modifyCovariance(vec3 originalCenter, vec3 modifiedCenter, inout vec3 covA, inout vec3 covB) {
    // no modification
}

void modifyColor(vec3 center, inout vec4 clr) {
    float sineValue = abs(sin(uTime * 5.0 + center.y));

    #ifdef CUTOUT
        // in cutout mode, remove pixels along the wave
        if (sineValue < 0.5) {
            clr.a = 0.0;
        }
    #else
        // in non-cutout mode, add a golden tint to the wave
        vec3 gold = vec3(1.0, 0.85, 0.0);
        float blend = smoothstep(0.9, 1.0, sineValue);
        clr.xyz = mix(clr.xyz, gold, blend);
    #endif
}

