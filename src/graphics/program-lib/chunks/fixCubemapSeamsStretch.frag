vec3 fixSeams(vec3 vec, float mipmapIndex) {
    RMEDP float scale = 1.0 - exp2(mipmapIndex) / 128.0;
    RMEDP float M = max(max(abs(vec.x), abs(vec.y)), abs(vec.z));
    if (abs(vec.x) != M) vec.x *= scale;
    if (abs(vec.y) != M) vec.y *= scale;
    if (abs(vec.z) != M) vec.z *= scale;
    return vec;
}

vec3 fixSeams(vec3 vec) {
    RMEDP float scale = 1.0 - 1.0 / 128.0;
    RMEDP float M = max(max(abs(vec.x), abs(vec.y)), abs(vec.z));
    if (abs(vec.x) != M) vec.x *= scale;
    if (abs(vec.y) != M) vec.y *= scale;
    if (abs(vec.z) != M) vec.z *= scale;
    return vec;
}

vec3 fixSeamsStatic(vec3 vec, float invRecMipSize) {
    RMEDP float scale = invRecMipSize;
    RMEDP float M = max(max(abs(vec.x), abs(vec.y)), abs(vec.z));
    if (abs(vec.x) != M) vec.x *= scale;
    if (abs(vec.y) != M) vec.y *= scale;
    if (abs(vec.z) != M) vec.z *= scale;
    return vec;
}

vec3 calcSeam(vec3 vec) {
    RMEDP vec3 avec = abs(vec);
    RMEDP float M = max(avec.x, max(avec.y, avec.z));
    return vec3(avec.x != M ? 1.0 : 0.0,
                avec.y != M ? 1.0 : 0.0,
                avec.z != M ? 1.0 : 0.0);
}

vec3 applySeam(vec3 vec, vec3 seam, float scale) {
    return vec * (seam * -scale + vec3(1.0));
}
