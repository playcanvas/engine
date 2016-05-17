float VSM(sampler2D tex, vec2 texCoords, float resolution, float Z, float vsmBias) {

    float pixelSize = 1.0 / resolution;
    texCoords -= vec2(pixelSize);
    vec3 s00 = texture2D(tex, texCoords).xy;
    vec3 s10 = texture2D(tex, texCoords + vec2(pixelSize, 0)).xy;
    vec3 s01 = texture2D(tex, texCoords + vec2(0, pixelSize)).xy;
    vec3 s11 = texture2D(tex, texCoords + vec2(pixelSize)).xy;
    vec3 fr = fract(texCoords * resolution);
    vec3 h0 = mix(s00, s10, fr.x);
    vec3 h1 = mix(s01, s11, fr.x);
    vec3 moments = mix(h0, h1, fr.y);
    return calculateVSM(moments, Z, vsmBias);
}

