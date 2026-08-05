export default /* glsl */`
    vec3 getCenter() { return loadDataCenter().xyz; }
    vec4 getColor() { return loadDataColor(); }
    vec3 getScale() { return vec3(loadDataCenter().w); }
    vec4 getRotation() { return vec4(0.0, 0.0, 0.0, 1.0); }
`;
