export default /* glsl */`
float VSM$(TEXTURE_ACCEPT(tex), vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {
    vec3 moments = texture2D(tex, texCoords).xyz;
    return calculateEVSM(moments, Z, vsmBias, exponent);
}

float getShadowVSM$(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, float exponent, vec3 lightDir) {
    return VSM$(TEXTURE_PASS(shadowMap), shadowCoord.xy, shadowParams.x, shadowCoord.z, shadowParams.y, exponent);
}

float getShadowSpotVSM$(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, float exponent, vec3 lightDir) {
    return VSM$(TEXTURE_PASS(shadowMap), shadowCoord.xy, shadowParams.x, length(lightDir) * shadowParams.w + shadowParams.z, shadowParams.y, exponent);
}
`;
