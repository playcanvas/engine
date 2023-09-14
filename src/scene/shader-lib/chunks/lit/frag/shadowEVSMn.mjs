export default /* glsl */`
float VSM$(TEXTURE_ACCEPT(tex), vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {
    float pixelSize = 1.0 / resolution;
    texCoords -= vec2(pixelSize);
    vec3 s00 = texture2D(tex, texCoords).xyz;
    vec3 s10 = texture2D(tex, texCoords + vec2(pixelSize, 0)).xyz;
    vec3 s01 = texture2D(tex, texCoords + vec2(0, pixelSize)).xyz;
    vec3 s11 = texture2D(tex, texCoords + vec2(pixelSize)).xyz;
    vec2 fr = fract(texCoords * resolution);
    vec3 h0 = mix(s00, s10, fr.x);
    vec3 h1 = mix(s01, s11, fr.x);
    vec3 moments = mix(h0, h1, fr.y);
    return calculateEVSM(moments, Z, vsmBias, exponent);
}

float getShadowVSM$(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, float exponent, vec3 lightDir) {
    return VSM$(TEXTURE_PASS(shadowMap), shadowCoord.xy, shadowParams.x, shadowCoord.z, shadowParams.y, exponent);
}

float getShadowSpotVSM$(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, float exponent, vec3 lightDir) {
    return VSM$(TEXTURE_PASS(shadowMap), shadowCoord.xy, shadowParams.x, length(lightDir) * shadowParams.w + shadowParams.z, shadowParams.y, exponent);
}
`;
