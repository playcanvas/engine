export default /* wgsl */`
output.Normal = normalize(localPos + uniform.matrix_viewInverse[2].xyz);
`;
