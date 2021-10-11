vec3 _getCookieClustered(sampler2D tex, vec2 uv, float intensity, bool isRgb, vec4 cookieChannel) {
    vec4 pixel = mix(vec4(1.0), texture2D(tex, uv), intensity);
    return isRgb == true ? pixel.rgb : vec3(dot(pixel, cookieChannel));
}

// getCookie2D for clustered lighting including channel selector
vec3 getCookie2DClustered(sampler2D tex, mat4 transform, vec3 worldPosition, float intensity, bool isRgb, vec4 cookieChannel) {
    vec4 projPos = transform * vec4(worldPosition, 1.0);
    return _getCookieClustered(tex, projPos.xy / projPos.w, intensity, isRgb, cookieChannel);
}

// getCookie for clustered omni light with the cookie texture being stored in the cookie atlas
vec3 getCookieCubeClustered(sampler2D tex, vec3 dir, float intensity, bool isRgb, vec4 cookieChannel, float shadowTextureResolution, float shadowEdgePixels, vec3 omniAtlasViewport) {
    vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);
    return _getCookieClustered(tex, uv, intensity, isRgb, cookieChannel);
}
