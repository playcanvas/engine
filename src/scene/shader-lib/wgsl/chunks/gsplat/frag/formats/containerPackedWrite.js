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
        writeDataTransformA(vec4u(gsplatPackCenterX(center.x), bitcast<u32>(center.y), bitcast<u32>(center.z), pack2x16float(rotation.xy)));
        writeDataTransformB(vec4u(pack2x16float(vec2f(rotation.z, scale.x)), pack2x16float(scale.yz), 0u, 0u));
    #endif
}
`;
