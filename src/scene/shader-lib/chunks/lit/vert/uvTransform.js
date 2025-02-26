// chunk that generates uv coordinate transformed by uv transform matrix
export default /* glsl */`
vUV_INJECT_TRANSFORM_UV_{i}__INJECT_TRANSFORM_ID_{i} = vec2(
    dot(vec3(uv_INJECT_TRANSFORM_UV_{i}, 1), _INJECT_TRANSFORM_NAME_{i}0),
    dot(vec3(uv_INJECT_TRANSFORM_UV_{i}, 1), _INJECT_TRANSFORM_NAME_{i}1)
);
`;
