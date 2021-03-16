float VSM$(sampler2D tex, vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {
    HIGHP float pixelSize = 1.0 / resolution;
    texCoords -= vec2(pixelSize);
    SMEDP vec3 s00 = texture2D(tex, texCoords).xyz;
    SMEDP vec3 s10 = texture2D(tex, texCoords + vec2(pixelSize, 0)).xyz;
    SMEDP vec3 s01 = texture2D(tex, texCoords + vec2(0, pixelSize)).xyz;
    SMEDP vec3 s11 = texture2D(tex, texCoords + vec2(pixelSize)).xyz;
    SMEDP vec2 fr = fract(texCoords * resolution);
    SMEDP vec3 h0 = mix(s00, s10, fr.x);
    SMEDP vec3 h1 = mix(s01, s11, fr.x);
    SMEDP vec3 moments = mix(h0, h1, fr.y);
    return calculateEVSM(moments, Z, vsmBias, exponent);
}

float getShadowVSM$(sampler2D shadowMap, vec3 shadowParams, float exponent) {
    return VSM$(shadowMap, dShadowCoord.xy, shadowParams.x, dShadowCoord.z, shadowParams.y, exponent);
}

float getShadowSpotVSM$(sampler2D shadowMap, vec4 shadowParams, float exponent) {
    return VSM$(shadowMap, dShadowCoord.xy, shadowParams.x, length(dLightDirW) * shadowParams.w + shadowParams.z, shadowParams.y, exponent);
}
