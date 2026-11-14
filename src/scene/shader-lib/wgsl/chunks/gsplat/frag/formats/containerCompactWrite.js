// Write function for compact work buffer format (20 bytes/splat).
export default /* wgsl */`
// Anti-aliasing flag of the splats being written (GSplatResourceBase#antiAlias), stored in the
// lowest bit of center.x and read back by getAntiAlias(). That moves the center by at most one
// float step. An infinite or NaN center.x is left as is, as the bit would change its value class.
uniform uAntiAlias: u32;

fn gsplatPackCenterX(x: f32) -> u32 {
    let bits = bitcast<u32>(x);
    return select((bits & ~1u) | uniform.uAntiAlias, bits, (bits & 0x7f800000u) == 0x7f800000u);
}

fn writeSplat(center: vec3f, rotation: vec4f, scale: vec3f, color: vec4f) {
    // Pack RGB as 11+11+10 bits into R32U, range [0, 4]
    let rgb = clamp(color.rgb, vec3f(0.0), vec3f(4.0));
    let rBits = u32(rgb.r * (2047.0 / 4.0) + 0.5);
    let gBits = u32(rgb.g * (2047.0 / 4.0) + 0.5);
    let bBits = u32(rgb.b * (1023.0 / 4.0) + 0.5);
    writeDataColor(vec4u(rBits | (gBits << 11u) | (bBits << 22u), 0u, 0u, 0u));

    #ifndef GSPLAT_COLOR_ONLY
        // Half-angle quaternion projection: rotation is (x,y,z,w) with w >= 0
        var q = rotation;
        if (q.w < 0.0) { q = -q; }
        let p = q.xyz * inverseSqrt(1.0 + q.w);

        // quantize from [-1, 1] to 11+11+10 bits
        let aBitsQ = u32(clamp(p.x * 0.5 + 0.5, 0.0, 1.0) * 2047.0 + 0.5);
        let bBitsQ = u32(clamp(p.y * 0.5 + 0.5, 0.0, 1.0) * 2047.0 + 0.5);
        let cBitsQ = u32(clamp(p.z * 0.5 + 0.5, 0.0, 1.0) * 1023.0 + 0.5);
        let packedQuat = aBitsQ | (bBitsQ << 11u) | (cBitsQ << 22u);

        // Log-encode scale (3x8 bits) + alpha (8 bits) into dataTransformA.w
        let invLogRange = 255.0 / 21.0;
        let logMin = -12.0;
        let sxBits = select(u32(clamp((log(scale.x) - logMin) * invLogRange + 0.5, 1.0, 255.0)), 0u, scale.x < 1e-10);
        let syBits = select(u32(clamp((log(scale.y) - logMin) * invLogRange + 0.5, 1.0, 255.0)), 0u, scale.y < 1e-10);
        let szBits = select(u32(clamp((log(scale.z) - logMin) * invLogRange + 0.5, 1.0, 255.0)), 0u, scale.z < 1e-10);
        // opacity as the SOG v3 byte, (b / 204)^2: 0..1.5625, exact at 0 and 1 (byte 204)
        let alphaBits = u32(min(sqrt(clamp(color.a, 0.0, 1.5625)) * 204.0 + 0.5, 255.0));
        let packedScaleAlpha = sxBits | (syBits << 8u) | (szBits << 16u) | (alphaBits << 24u);

        writeDataTransformA(vec4u(gsplatPackCenterX(center.x), bitcast<u32>(center.y), bitcast<u32>(center.z), packedScaleAlpha));

        writeDataTransformB(vec4u(packedQuat, 0u, 0u, 0u));
    #endif
}
`;
