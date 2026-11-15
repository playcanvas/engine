// Write function for packed (large) work buffer format (32 bytes/splat).
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
    writeDataColor(color);
    #ifndef GSPLAT_COLOR_ONLY
        // only x, y, z are stored and the reader rebuilds w >= 0, so store the w >= 0 form of
        // the rotation (q and -q are the same rotation). A modifySplatRotationScale that rotates
        // the splat can leave w < 0, which would otherwise read back as the inverse rotation.
        let q = select(rotation, -rotation, rotation.w < 0.0);
        writeDataTransformA(vec4u(gsplatPackCenterX(center.x), bitcast<u32>(center.y), bitcast<u32>(center.z), pack2x16float(q.xy)));
        writeDataTransformB(vec4u(pack2x16float(vec2f(q.z, scale.x)), pack2x16float(scale.yz), 0u, 0u));
    #endif
}
`;
