// Template for a user gsplat varying - writes one component to a projection cache word
// Placeholders: {word}, {value}
export default /* wgsl */`
projCache[base + {word}u] = {value};
`;
