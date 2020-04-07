vec3 combineColor() {
    return dAlbedo * dDiffuseLight + dSpecularLight * dSpecularity;
}

vec3 combineColorCC() {

    return combineColor()+(ccSpecularLight*ccSpecularity);
}
