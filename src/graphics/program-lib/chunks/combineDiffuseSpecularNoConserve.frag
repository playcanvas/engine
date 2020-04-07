vec3 combineColor() {
    return dAlbedo * dDiffuseLight + (dSpecularLight + dReflection.rgb * dReflection.a) * dSpecularity;
}

vec3 combineColorCC() {

    return combineColor()+(ccSpecularLight*ccSpecularity+ccReflection.rgb*ccSpecularity*ccReflection.a);
}
