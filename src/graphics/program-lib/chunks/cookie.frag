vec4 getCookie2D(sampler2D tex, mat4 transform, float intensity) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    return mix(vec4(1.0), texture2D(tex, projPos.xy), intensity);
}

vec4 getCookie2DClip(sampler2D tex, mat4 transform, float intensity) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    if (projPos.x < 0.0 || projPos.x > 1.0 || projPos.y < 0.0 || projPos.y > 1.0 || projPos.z < 0.0) return vec4(0.0);
    return mix(vec4(1.0), texture2D(tex, projPos.xy), intensity);
}

vec4 getCookie2DXform(sampler2D tex, mat4 transform, float intensity, vec4 cookieMatrix, vec2 cookieOffset) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    projPos.xy += cookieOffset;
    vec2 uv = mat2(cookieMatrix) * (projPos.xy-vec2(0.5)) + vec2(0.5);
    return mix(vec4(1.0), texture2D(tex, uv), intensity);
}

vec4 getCookie2DClipXform(sampler2D tex, mat4 transform, float intensity, vec4 cookieMatrix, vec2 cookieOffset) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    projPos.xy += cookieOffset;
    if (projPos.x < 0.0 || projPos.x > 1.0 || projPos.y < 0.0 || projPos.y > 1.0 || projPos.z < 0.0) return vec4(0.0);
    vec2 uv = mat2(cookieMatrix) * (projPos.xy-vec2(0.5)) + vec2(0.5);
    return mix(vec4(1.0), texture2D(tex, uv), intensity);
}

vec4 getCookieCube(samplerCube tex, mat4 transform, float intensity) {
    return mix(vec4(1.0), textureCube(tex, dLightDirNormW * mat3(transform)), intensity);
}

