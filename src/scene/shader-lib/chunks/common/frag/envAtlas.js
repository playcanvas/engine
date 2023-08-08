export default /* glsl */`
// the envAtlas is fixed at 512 pixels. every equirect is generated with 1 pixel boundary.
const float atlasSize = 512.0;
const float seamSize = 1.0 / atlasSize;

// map a normalized equirect UV to the given rectangle (taking 1 pixel seam into account).
vec2 mapUv(vec2 uv, vec4 rect) {
    return vec2(mix(rect.x + seamSize, rect.x + rect.z - seamSize, uv.x),
                mix(rect.y + seamSize, rect.y + rect.w - seamSize, uv.y));
}

// map a normalized equirect UV and roughness level to the correct atlas rect.
vec2 mapRoughnessUv(vec2 uv, float level) {
    float t = 1.0 / exp2(level);
    return mapUv(uv, vec4(0, 1.0 - t, t, t * 0.5));
}

// map shiny level UV
vec2 mapShinyUv(vec2 uv, float level) {
    float t = 1.0 / exp2(level);
    return mapUv(uv, vec4(1.0 - t, 1.0 - t, t, t * 0.5));
}
`;
