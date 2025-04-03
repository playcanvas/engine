export default /* wgsl */`
    color += uniform.morphFactor[{i}].element * textureSampleLevel(morphBlendTex{i}, morphBlendTex{i}Sampler, input.uv0, 0).xyz;
`;
