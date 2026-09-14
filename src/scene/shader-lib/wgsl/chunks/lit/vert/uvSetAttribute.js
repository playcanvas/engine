// attribute declaration of an additional uv set (UV2 and up), expanded once per used set
export default /* wgsl */`
attribute vertex_texCoord{UV_SET_{i}}: vec2f;
`;
