// Write function for packed (large) work buffer format (32 bytes/splat).
export default /* wgsl */`
fn writeSplat(center: vec3f, rotation: vec4f, scale: vec3f, color: vec4f) {
    writeDataColor(color);
    #ifndef GSPLAT_COLOR_ONLY
        writeDataTransformA(vec4u(bitcast<u32>(center.x), bitcast<u32>(center.y), bitcast<u32>(center.z), pack2x16float(rotation.xy)));
        writeDataTransformB(vec4u(pack2x16float(vec2f(rotation.z, scale.x)), pack2x16float(scale.yz), 0u, 0u));
    #endif
}
`;
