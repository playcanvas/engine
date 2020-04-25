vec3 combineColor() {
    vec3 combinedSpecular = (dSpecularLight + dReflection.rgb * dReflection.a) * dSpecularity;
    return dAlbedo * dDiffuseLight + combinedSpecular;
}

