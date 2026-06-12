// Template for a user gsplat varying - copies the private value to the vertex output struct
// Placeholders: {name}
export default /* wgsl */`
output.user_{name} = _user_{name};
`;
