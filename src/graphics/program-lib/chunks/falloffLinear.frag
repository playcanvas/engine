float getFalloffLinear(inout psInternalData data, float lightRadius) {
    float d = length(data.lightDirW);
    return max(((lightRadius - d) / lightRadius), 0.0);
}

