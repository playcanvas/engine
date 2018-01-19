
    vec2 screenTC = gl_FragCoord.xy * uScreenSize.zw;

    #ifdef GL2
        float depth = texture2D(uDepthMap, screenTC).r;
        depth = (2.0 * camera_near) / (camera_far + camera_near - depth * (camera_far - camera_near)); // linearize
        depth *= camera_far;
    #else
        float depth = unpackFloat( texture2D(uDepthMap, screenTC) ) * camera_far;
    #endif

    float particleDepth = vDepth;
    float depthDiff = saturate(abs(particleDepth - depth) * softening);
    a *= depthDiff;
