vec3 getCookie2D(sampler2D tex, mat4 transform, float intensity) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    return mix(vec3(1.0), texture2D(tex, projPos.xy).rgb, intensity);
}

vec3 getCookie2DClip(sampler2D tex, mat4 transform, float intensity) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    if (projPos.x < 0.0 || projPos.x > 1.0 || projPos.y < 0.0 || projPos.y > 1.0 || projPos.z < 0.0) return vec3(0.0);
    return mix(vec3(1.0), texture2D(tex, projPos.xy).rgb, intensity);
}

vec3 getCookieCube(samplerCube tex, mat4 transform, float intensity) {
    return mix(vec3(1.0), textureCube(tex, dLightDirNormW * mat3(transform)).rgb, intensity);
}

