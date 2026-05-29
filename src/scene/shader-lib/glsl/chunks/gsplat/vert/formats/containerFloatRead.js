// Read functions for GSplatContainer float format (RGBA16F/RGBA32F textures)
export default /* glsl */`
vec3 getCenter() { return loadDataCenter().xyz; }
vec4 getColor() { return loadDataColor(); }
vec3 getScale() { return loadDataScale().xyz; }
vec4 getRotation() { return loadDataRotation(); }
`;
