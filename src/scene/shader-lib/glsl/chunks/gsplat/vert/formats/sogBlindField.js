// Template for a SOG v3 blind field accessor, using the gsplatSogBlindVS helpers (see
// gsplat-sog-blind.js)
// Placeholders: {id}, {returnType}, {texture}, {offset}, {bytes}, {decode}
export default /* glsl */`
{returnType} getBlind_{id}() { uint bits = sogBlindBits(loadBlind{texture}(), {offset}u, {bytes}u); return {decode}; }
`;
