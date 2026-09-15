// chunk that passes an additional uv set (UV2 and up) to the fragment shader untransformed
export default /* glsl */`
vUv{UV_VARYING_SET_{i}} = uv{UV_VARYING_SET_{i}};
`;
