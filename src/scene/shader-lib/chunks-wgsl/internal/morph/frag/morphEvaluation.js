export default /* wgsl */`
    color += uniform.morphFactor[{i}].x * textureSample(morphBlendTex{i}, morphBlendTex{i}Sampler, input.uv0).xyz;
`;
