export default /* glsl */`
vec3 combineColorCC() {
    return combineColor() + ccSpecularLight + ccReflection.rgb * ccReflection.a;
}
`;
