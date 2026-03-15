export default /* wgsl */`
fn _getCookieClustered(tex: texture_2d<f32>, texSampler: sampler, uv: vec2f, intensity: f32, cookieChannel: vec4f) -> vec3f {
    let pixel: vec4f = mix(vec4f(1.0), textureSampleLevel(tex, texSampler, uv, 0.0), intensity);
    let isRgb: bool = dot(cookieChannel.rgb, vec3f(1.0)) == 3.0;
    return select(vec3f(dot(pixel, cookieChannel)), pixel.rgb, isRgb);
}

// getCookie2D for clustered lighting including channel selector
fn getCookie2DClustered(tex: texture_2d<f32>, texSampler: sampler, transform: mat4x4f, worldPosition: vec3f, intensity: f32, cookieChannel: vec4f) -> vec3f {
    let projPos: vec4f = transform * vec4f(worldPosition, 1.0);
    return _getCookieClustered(tex, texSampler, projPos.xy / projPos.w, intensity, cookieChannel);
}

// getCookie for clustered omni light with the cookie texture being stored in the cookie atlas
fn getCookieCubeClustered(tex: texture_2d<f32>, texSampler: sampler, dir: vec3f, intensity: f32, cookieChannel: vec4f, shadowTextureResolution: f32, shadowEdgePixels: f32, omniAtlasViewport: vec3f) -> vec3f {
    let uv: vec2f = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);
    return _getCookieClustered(tex, texSampler, uv, intensity, cookieChannel);
}
`;
