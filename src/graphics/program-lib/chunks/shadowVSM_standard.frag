float calculateVSM(vec2 moments, float Z) {
    float VSMBias = 0.01 * 0.25;
    float depthScale = VSMBias * Z;
    float minVariance1 = depthScale * depthScale;
    return chebyshevUpperBound(moments.xy, Z, minVariance1, 0.05);
}

