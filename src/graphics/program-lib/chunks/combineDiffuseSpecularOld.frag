vec3 combineColor() {
    return mix(dAlbedo * dDiffuseLight + dSpecularLight * dSpecularity, dReflection.rgb, dReflection.a);
}

vec3 combineColorCC() {

    return combineColor()+(ccSpecularLight*ccSpecularity+ccReflection.rgb*ccSpecularity*ccReflection.a);
}
