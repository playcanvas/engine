// Template for a SOG v3 blind field accessor, using the gsplatSogBlindVS helpers (see
// gsplat-sog-blind.js)
// Placeholders: {id}, {returnType}, {texture}, {offset}, {bytes}, {decode}
export default /* wgsl */`
fn getBlind_{id}() -> {returnType} { let bits = sogBlindBits(loadBlind{texture}(), {offset}u, {bytes}u); return {decode}; }
`;
