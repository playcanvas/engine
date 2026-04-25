// Write function for packed (large) work buffer format (32 bytes/splat).
export default /* glsl */`
void writeSplat(vec3 center, vec4 rotation, vec3 scale, vec4 color) {
    #ifdef GSPLAT_COLOR_UINT
        uint packed_rg = packHalf2x16(color.rg);
        uint packed_ba = packHalf2x16(color.ba);
        writeDataColor(uvec4(
            packed_rg & 0xFFFFu,
            packed_rg >> 16u,
            packed_ba & 0xFFFFu,
            packed_ba >> 16u
        ));
    #else
        writeDataColor(color);
    #endif
    #ifndef GSPLAT_COLOR_ONLY
        writeDataTransformA(uvec4(floatBitsToUint(center.x), floatBitsToUint(center.y), floatBitsToUint(center.z), packHalf2x16(rotation.xy)));
        writeDataTransformB(uvec4(packHalf2x16(vec2(rotation.z, scale.x)), packHalf2x16(scale.yz), 0u, 0u));
    #endif
}
`;
