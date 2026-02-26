// Write function for compact work buffer format (20 bytes/splat).
export default /* glsl */`
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

        writeDataTransformA(uvec4(floatBitsToUint(center.x), floatBitsToUint(center.y), floatBitsToUint(center.z), packedQuat));

        // Log-encode scale (3x8 bits) + alpha (8 bits)
        const float invLogRange = 255.0 / 21.0;
        const float logMin = -12.0;
        uint sxBits = scale.x < 1e-10 ? 0u : uint(clamp((log(scale.x) - logMin) * invLogRange + 0.5, 1.0, 255.0));
        uint syBits = scale.y < 1e-10 ? 0u : uint(clamp((log(scale.y) - logMin) * invLogRange + 0.5, 1.0, 255.0));
        uint szBits = scale.z < 1e-10 ? 0u : uint(clamp((log(scale.z) - logMin) * invLogRange + 0.5, 1.0, 255.0));
        uint alphaBits = uint(clamp(color.a, 0.0, 1.0) * 255.0 + 0.5);
        uint packedScale = sxBits | (syBits << 8u) | (szBits << 16u) | (alphaBits << 24u);

        writeDataTransformB(uvec4(packedScale, 0u, 0u, 0u));
    #endif
}
`;
