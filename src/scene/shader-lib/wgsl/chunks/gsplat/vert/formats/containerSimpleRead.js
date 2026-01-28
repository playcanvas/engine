export default /* wgsl */`
    fn getCenter() -> vec3f { return loadDataCenter().xyz; }
    fn getColor() -> vec4f { return loadDataColor(); }
    fn getScale() -> vec3f { return vec3f(loadDataCenter().w); }
    fn getRotation() -> vec4f { return vec4f(0.0, 0.0, 0.0, 1.0); }
`;
