export default /* wgsl */`
    color += uniform.morphFactor[{i}].element * textureSample(morphBlendTex{i}, morphBlendTex{i}Sampler, input.uv0).xyz;
`;
