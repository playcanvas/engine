void processMetalness(float metalness) {
    const float dielectricF0 = 0.04;
    dSpecularity = mix(vec3(dielectricF0), dAlbedo, metalness);
    dAlbedo *= 1.0 - metalness;
}

