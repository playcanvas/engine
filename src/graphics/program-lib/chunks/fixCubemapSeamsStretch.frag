vec3 fixSeams(vec3 vec, float mipmapIndex) {
    vec3 avec = abs(vec);
    float scale = 1.0 - exp2(mipmapIndex) / 128.0;
    float M = max(max(avec.x, avec.y), avec.z);
    if (avec.x != M) vec.x *= scale;
    if (avec.y != M) vec.y *= scale;
    if (avec.z != M) vec.z *= scale;
    return vec;
}

vec3 fixSeams(vec3 vec) {
    vec3 avec = abs(vec);
    float scale = 1.0 - 1.0 / 128.0;
    float M = max(max(avec.x, avec.y), avec.z);
    if (avec.x != M) vec.x *= scale;
    if (avec.y != M) vec.y *= scale;
    if (avec.z != M) vec.z *= scale;
    return vec;
}

vec3 fixSeamsStatic(vec3 vec, float invRecMipSize) {
    vec3 avec = abs(vec);
    float scale = invRecMipSize;
    float M = max(max(avec.x, avec.y), avec.z);
    if (avec.x != M) vec.x *= scale;
    if (avec.y != M) vec.y *= scale;
    if (avec.z != M) vec.z *= scale;
    return vec;
}

vec3 calcSeam(vec3 vec) {
    vec3 avec = abs(vec);
    float M = max(avec.x, max(avec.y, avec.z));
    return vec3(avec.x != M ? 1.0 : 0.0,
                avec.y != M ? 1.0 : 0.0,
                avec.z != M ? 1.0 : 0.0);
}

vec3 applySeam(vec3 vec, vec3 seam, float scale) {
    return vec * (seam * -scale + vec3(1.0));
}
