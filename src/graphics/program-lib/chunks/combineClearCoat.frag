vec3 combineColorCC() {
    return combineColor()+(ccSpecularLight*ccSpecularity+ccReflection.rgb*ccSpecularity*ccReflection.a);
}
