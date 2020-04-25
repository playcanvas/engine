vec3 combineColor() {
    vec3 combinedSpecular = dSpecularLight * dSpecularity;
    return dAlbedo * dDiffuseLight + combinedSpecular;
}

