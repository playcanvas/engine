vec3 combineColor() {
    vec3 combinedSpecular = dSpecularLight * dSpecularity;
    return mix(dAlbedo * dDiffuseLight + combinedSpecular, dReflection.rgb, dReflection.a);
}

