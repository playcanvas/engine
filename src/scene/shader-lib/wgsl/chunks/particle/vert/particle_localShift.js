export default /* wgsl */`
particlePos = (uniform.matrix_model * vec4f(particlePos, 1.0)).xyz;
`;
