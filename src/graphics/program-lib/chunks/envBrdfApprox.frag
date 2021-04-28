// Adapted from https://www.unrealengine.com/en-US/blog/physically-based-shading-on-mobile
vec3 envBrdf(vec3 specularColor, float glossiness, vec3 normal) {
    const vec4 c0 = vec4(-1, -0.0275, -0.572, 0.022);
    const vec4 c1 = vec4(1, 0.0425, 1.04, -0.04);
    vec4 r = (1.0 - glossiness) * c0 + c1;
    float a004 = min(r.x * r.x, exp2(-9.28 * dot(normal, dViewDirW))) * r.x + r.y;
    vec2 AB = vec2(-1.04, 1.04) * a004 + r.zw;
    return specularColor * AB.x + AB.y;
}
