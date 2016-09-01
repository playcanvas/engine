
    vec2 screenTC = gl_FragCoord.xy * uScreenSize.zw;
    float depth = unpackFloat( texture2D(uDepthMap, screenTC) ) * camera_far;
    float particleDepth = vDepth;
    float depthDiff = saturate(abs(particleDepth - depth) * softening);
    a *= depthDiff;

