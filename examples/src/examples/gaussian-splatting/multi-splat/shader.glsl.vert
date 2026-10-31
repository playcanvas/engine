uniform float uTime;

void modifySplatCenter(inout vec3 center) {
    // modify center
    float heightIntensity = center.y * 0.2;
    center.x += sin(uTime * 5.0 + center.y) * 0.3 * heightIntensity;
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
    // no modification
}

void modifySplatColor(vec3 center, inout vec4 clr) {
    float sineValue = abs(sin(uTime * 5.0 + center.y));

    vec3 gold = vec3(1.0, 0.85, 0.0);
    float blend = smoothstep(0.9, 1.0, sineValue);
    clr.xyz = mix(clr.xyz, gold, blend);
}
