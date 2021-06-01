vec3 combineColor() {
    return dAlbedo * dDiffuseLight + (dSpecularLight * dSpecularity) + dReflection.rgb * dReflection.a;
}
