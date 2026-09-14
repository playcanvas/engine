// chunk that reads an additional uv set (UV2 and up) into the local used by uv transforms and varyings
export default /* glsl */`
vec2 uv{UV_SET_{i}} = vertex_texCoord{UV_SET_{i}};
`;
