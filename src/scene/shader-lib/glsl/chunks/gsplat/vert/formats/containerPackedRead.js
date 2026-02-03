// Read functions for packed format - used by:
// - GSplatFormat.createPackedFormat() for reading from GSplatContainer (RGBA16U color)
// - Work buffer format for reading during forward rendering (RGBA16F/RGBA16U color)
// Uses GSPLAT_COLOR_FLOAT define to switch between float and uint color reading paths
export default /* glsl */`
// cached texture fetches
uvec4 cachedTransformA;
uvec2 cachedTransformB;

vec3 getCenter() {
    cachedTransformA = loadDataTransformA();
    cachedTransformB = loadDataTransformB().xy;
    return vec3(uintBitsToFloat(cachedTransformA.r), uintBitsToFloat(cachedTransformA.g), uintBitsToFloat(cachedTransformA.b));
}

vec4 getColor() {
    #ifdef GSPLAT_COLOR_FLOAT
        return loadDataColor();
    #else
        // Unpack RGBA from 4x half-float (16-bit) values stored in RGBA16U format
        uvec4 packedColor = loadDataColor();
        uint packed_rg = packedColor.r | (packedColor.g << 16u);
        uint packed_ba = packedColor.b | (packedColor.a << 16u);
        return vec4(unpackHalf2x16(packed_rg), unpackHalf2x16(packed_ba));
    #endif
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
