export default /* glsl */`
vec3 combineColor() {
    return mix(dAlbedo * dDiffuseLight, vec3(1.0), dSpecularLight + dReflection.rgb * dReflection.a);
}
`;
