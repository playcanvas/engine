// Write function for compact work buffer format (20 bytes/splat).
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
    // Pack RGB as 11+11+10 bits into R32U, range [0, 4]
    vec3 rgb = clamp(color.rgb, 0.0, 4.0);
    uint rBits = uint(rgb.r * (2047.0 / 4.0) + 0.5);
    uint gBits = uint(rgb.g * (2047.0 / 4.0) + 0.5);
    uint bBits = uint(rgb.b * (1023.0 / 4.0) + 0.5);
    writeDataColor(uvec4(rBits | (gBits << 11u) | (bBits << 22u), 0u, 0u, 0u));

    #ifndef GSPLAT_COLOR_ONLY
        // Half-angle quaternion projection: rotation is (x,y,z,w) with w >= 0
        vec4 q = rotation;
        if (q.w < 0.0) q = -q;
        vec3 p = q.xyz * inversesqrt(1.0 + q.w);

        // quantize from [-1, 1] to 11+11+10 bits
        uint aBitsQ = uint(clamp((p.x * 0.5 + 0.5) * 2047.0 + 0.5, 0.0, 2047.0));
        uint bBitsQ = uint(clamp((p.y * 0.5 + 0.5) * 2047.0 + 0.5, 0.0, 2047.0));
        uint cBitsQ = uint(clamp((p.z * 0.5 + 0.5) * 1023.0 + 0.5, 0.0, 1023.0));
        uint packedQuat = aBitsQ | (bBitsQ << 11u) | (cBitsQ << 22u);

        // Log-encode scale (3x8 bits) + alpha (8 bits) into dataTransformA.w
        const float invLogRange = 255.0 / 21.0;
        const float logMin = -12.0;
        uint sxBits = scale.x < 1e-10 ? 0u : uint(clamp((log(scale.x) - logMin) * invLogRange + 0.5, 1.0, 255.0));
        uint syBits = scale.y < 1e-10 ? 0u : uint(clamp((log(scale.y) - logMin) * invLogRange + 0.5, 1.0, 255.0));
        uint szBits = scale.z < 1e-10 ? 0u : uint(clamp((log(scale.z) - logMin) * invLogRange + 0.5, 1.0, 255.0));
        // opacity as the SOG v3 byte, (b / 204)^2: 0..1.5625, exact at 0 and 1 (byte 204)
        uint alphaBits = uint(min(sqrt(clamp(color.a, 0.0, 1.5625)) * 204.0 + 0.5, 255.0));
        uint packedScaleAlpha = sxBits | (syBits << 8u) | (szBits << 16u) | (alphaBits << 24u);

        writeDataTransformA(uvec4(gsplatPackCenterX(center.x), floatBitsToUint(center.y), floatBitsToUint(center.z), packedScaleAlpha));

        writeDataTransformB(uvec4(packedQuat, 0u, 0u, 0u));
    #endif
}
`;
