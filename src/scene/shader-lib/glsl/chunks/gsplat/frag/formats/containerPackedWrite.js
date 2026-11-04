// Write function for packed (large) work buffer format (32 bytes/splat).
export default /* glsl */`
// Anti-aliasing flag of the splats being written (GSplatResourceBase#antiAlias), stored in the
// lowest bit of center.x and read back by getAntiAlias(). That moves the center by at most one
// float step. An infinite or NaN center.x is left as is, as the bit would change its value class.
uniform uint uAntiAlias;

uint gsplatPackCenterX(float x) {
    uint bits = floatBitsToUint(x);
    return (bits & 0x7f800000u) == 0x7f800000u ? bits : ((bits & ~1u) | uAntiAlias);
}

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
        writeDataTransformA(uvec4(gsplatPackCenterX(center.x), floatBitsToUint(center.y), floatBitsToUint(center.z), packHalf2x16(rotation.xy)));
        writeDataTransformB(uvec4(packHalf2x16(vec2(rotation.z, scale.x)), packHalf2x16(scale.yz), 0u, 0u));
    #endif
}
`;
