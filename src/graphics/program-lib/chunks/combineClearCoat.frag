vec3 combineColorCC() {
    return combineColor() + (ccSpecularLight * ccSpecularity + ccReflection.rgb * ccReflection.a);   
}
