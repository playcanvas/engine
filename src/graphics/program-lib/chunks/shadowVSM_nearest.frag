float VSM(sampler2D tex, vec2 texCoords, float resolution, float Z) {

    float pixelSize = 1.0 / resolution;
    texCoords -= vec2(pixelSize);
    vec2 s00 = texture2D(tex, texCoords).xy;
    vec2 s10 = texture2D(tex, texCoords + vec2(pixelSize, 0)).xy;
    vec2 s01 = texture2D(tex, texCoords + vec2(0, pixelSize)).xy;
    vec2 s11 = texture2D(tex, texCoords + vec2(pixelSize)).xy;
    vec2 fr = fract(texCoords * resolution);
    vec2 h0 = mix(s00, s10, fr.x);
    vec2 h1 = mix(s01, s11, fr.x);
    vec2 moments = mix(h0, h1, fr.y);
    return calculateVSM(moments, Z);
}

