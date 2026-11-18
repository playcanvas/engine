// Modifies the ambient lighting of the lit shader, and occludes the reflections of the environment.
// By default it changes neither. Internal: the probe volume of the extras replaces it.
export default /* glsl */`

// returns the ambient light of a surface, from the ambient light of the scene at it
vec3 modifyAmbient(vec3 ambient, vec3 worldNormal) {
    return ambient;
}

// returns the scale of the reflections of the environment, called after modifyAmbient
float getReflectionOcclusion() {
    return 1.0;
}
`;
