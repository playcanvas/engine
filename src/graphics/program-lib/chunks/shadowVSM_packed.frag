float decodeFloatRG(vec2 rg) {
    return rg.y*(1.0/255.0) + rg.x;
}

float VSM(sampler2D tex, vec2 texCoords, float resolution, float Z) {
    vec4 c = texture2D(tex, texCoords);
    vec2 moments = vec2(decodeFloatRG(c.xy), decodeFloatRG(c.zw));
    return calculateVSM(moments, Z);
}

