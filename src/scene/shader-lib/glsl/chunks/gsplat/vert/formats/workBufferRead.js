// Read functions for work buffer format - reads from sorted work buffer in unified rendering mode
export default /* glsl */`
// cached texture fetches
uvec4 cachedSplatTexture0Data;
uvec2 cachedSplatTexture1Data;

// read the model-space center of the gaussian
vec3 getCenter(SplatSource source) {
    // Initialize splatUV for generated load functions
    splatUV = source.uv;

    cachedSplatTexture0Data = texelFetch(splatTexture0, splatUV, 0);
    cachedSplatTexture1Data = texelFetch(splatTexture1, splatUV, 0).xy;
    return vec3(uintBitsToFloat(cachedSplatTexture0Data.r), uintBitsToFloat(cachedSplatTexture0Data.g), uintBitsToFloat(cachedSplatTexture0Data.b));
}

vec4 getRotation() {
    vec2 rotXY = unpackHalf2x16(cachedSplatTexture0Data.a);
    vec2 rotZscaleX = unpackHalf2x16(cachedSplatTexture1Data.x);
    vec3 rotXYZ = vec3(rotXY, rotZscaleX.x);
    return vec4(rotXYZ, sqrt(max(0.0, 1.0 - dot(rotXYZ, rotXYZ)))).wxyz;
}

vec3 getScale() {
    vec2 rotZscaleX = unpackHalf2x16(cachedSplatTexture1Data.x);
    vec2 scaleYZ = unpackHalf2x16(cachedSplatTexture1Data.y);
    return vec3(rotZscaleX.y, scaleYZ);
}

vec4 getColor(in SplatSource source) {
    #ifdef GSPLAT_COLOR_UINT
        // Unpack RGBA from 4x half-float (16-bit) values stored in RGBA16U format
        uvec4 packed = texelFetch(splatColor, splatUV, 0);
        uint packed_rg = packed.r | (packed.g << 16u);
        uint packed_ba = packed.b | (packed.a << 16u);
        return vec4(unpackHalf2x16(packed_rg), unpackHalf2x16(packed_ba));
    #else
        return texelFetch(splatColor, splatUV, 0);
    #endif
}
`;
