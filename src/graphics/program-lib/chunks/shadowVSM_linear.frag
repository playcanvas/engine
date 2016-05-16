float VSM(sampler2D tex, vec2 texCoords, float resolution, float Z) {

    vec2 moments = texture2D(tex, texCoords).xy;
    return calculateVSM(moments, Z);
}

