// Template for a user gsplat varying - reads the value from the projection cache and writes it
// to the vertex output struct
// Placeholders: {name}, {value}
export default /* wgsl */`
output.user_{name} = {value};
`;
