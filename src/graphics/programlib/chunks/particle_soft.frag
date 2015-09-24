
    vec2 screenTC = gl_FragCoord.xy * uScreenSize.zw;
    float depth = unpackFloat( texture2D(uDepthMap, screenTC) ) * camera_far;
    float particleDepth = gl_FragCoord.z / gl_FragCoord.w;
    float depthDiff = saturate(abs(particleDepth - depth) * softening);
    a *= depthDiff;

