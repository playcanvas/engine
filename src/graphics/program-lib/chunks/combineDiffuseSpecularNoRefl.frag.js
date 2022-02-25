export default /* glsl */`
vec3 combineColor() {
    return dAlbedo * dDiffuseLight + dSpecularLight * dSpecularity;
}
`;
