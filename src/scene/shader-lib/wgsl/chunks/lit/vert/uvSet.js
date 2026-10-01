// chunk that reads an additional uv set (UV2 and up) into the local used by uv transforms and varyings
export default /* wgsl */`
var uv{UV_SET_{i}}: vec2f = vertex_texCoord{UV_SET_{i}};
`;
