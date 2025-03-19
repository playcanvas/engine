export default /* glsl */`
    color.xyz += morphFactor[{i}] * texture2D(morphBlendTex{i}, uv0).xyz;
`;
