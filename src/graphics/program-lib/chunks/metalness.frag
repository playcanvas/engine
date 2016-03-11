void processMetalness(inout psInternalData data, float metalness) {
    const float dielectricF0 = 0.04;
    data.specularity = mix(vec3(dielectricF0), data.albedo, metalness);
    data.albedo *= 1.0 - metalness;
}

