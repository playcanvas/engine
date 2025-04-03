export default /* glsl */`
    color.xyz += morphFactor[{i}] * texture2DLod(morphBlendTex{i}, uv0, 0.0).xyz;
`;
