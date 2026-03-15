export default /* glsl */`
vec3 _getCookieClustered(TEXTURE_ACCEPT(tex), vec2 uv, float intensity, vec4 cookieChannel) {
    vec4 pixel = mix(vec4(1.0), texture2DLod(tex, uv, 0.0), intensity);
    bool isRgb = dot(cookieChannel.rgb, vec3(1.0)) == 3.0;
    return isRgb ? pixel.rgb : vec3(dot(pixel, cookieChannel));
}

// getCookie2D for clustered lighting including channel selector
vec3 getCookie2DClustered(TEXTURE_ACCEPT(tex), mat4 transform, vec3 worldPosition, float intensity, vec4 cookieChannel) {
    vec4 projPos = transform * vec4(worldPosition, 1.0);
    return _getCookieClustered(TEXTURE_PASS(tex), projPos.xy / projPos.w, intensity, cookieChannel);
}

// getCookie for clustered omni light with the cookie texture being stored in the cookie atlas
vec3 getCookieCubeClustered(TEXTURE_ACCEPT(tex), vec3 dir, float intensity, vec4 cookieChannel, float shadowTextureResolution, float shadowEdgePixels, vec3 omniAtlasViewport) {
    vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);
    return _getCookieClustered(TEXTURE_PASS(tex), uv, intensity, cookieChannel);
}
`;
