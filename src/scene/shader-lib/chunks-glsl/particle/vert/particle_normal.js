export default /* glsl */`
    Normal = normalize(localPos + matrix_viewInverse[2].xyz);
`;
