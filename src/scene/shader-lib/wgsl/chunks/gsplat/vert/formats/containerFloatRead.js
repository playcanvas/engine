// Read functions for GSplatContainer float format (RGBA16F/RGBA32F textures)
export default /* wgsl */`
fn getCenter() -> vec3f { return loadDataCenter().xyz; }
fn getColor() -> vec4f { return loadDataColor(); }
fn getScale() -> vec3f { return loadDataScale().xyz; }
fn getRotation() -> vec4f { return loadDataRotation(); }
`;
