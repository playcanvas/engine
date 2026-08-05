// Read functions for large work buffer format (GSPLATDATA_LARGE, 32 bytes/splat).
// Uses GSPLAT_COLOR_FLOAT define to switch between float and uint color reading paths.
export default /* glsl */`
// Required call order: getCenter() first, then getOpacity() (loads and caches color),
// then getColor() (returns cached RGB). getRotation(), getScale() can follow in any order.
uvec4 cachedTransformA;
uvec2 cachedTransformB;
vec4 cachedColor;

vec3 getCenter() {
    cachedTransformA = loadDataTransformA();
    cachedTransformB = loadDataTransformB().xy;
    return vec3(uintBitsToFloat(cachedTransformA.r), uintBitsToFloat(cachedTransformA.g), uintBitsToFloat(cachedTransformA.b));
}

float getOpacity() {
    #ifdef GSPLAT_COLOR_FLOAT
        cachedColor = loadDataColor();
    #else
        uvec4 packedColor = loadDataColor();
        uint packed_rg = packedColor.r | (packedColor.g << 16u);
        uint packed_ba = packedColor.b | (packedColor.a << 16u);
        cachedColor = vec4(unpackHalf2x16(packed_rg), unpackHalf2x16(packed_ba));
    #endif
    return cachedColor.a;
}

vec3 getColor() {
    return cachedColor.rgb;
}

vec4 getRotation() {
    vec2 rotXY = unpackHalf2x16(cachedTransformA.a);
    vec2 rotZscaleX = unpackHalf2x16(cachedTransformB.x);
    vec3 rotXYZ = vec3(rotXY, rotZscaleX.x);
    return vec4(rotXYZ, sqrt(max(0.0, 1.0 - dot(rotXYZ, rotXYZ)))).wxyz;
}

vec3 getScale() {
    vec2 rotZscaleX = unpackHalf2x16(cachedTransformB.x);
    vec2 scaleYZ = unpackHalf2x16(cachedTransformB.y);
    return vec3(rotZscaleX.y, scaleYZ);
}
`;
