vec3 combineColor() {
    return dAlbedo * dDiffuseLight + (dSpecularLight + dReflection.rgb * dReflection.a) * dSpecularity;
}

