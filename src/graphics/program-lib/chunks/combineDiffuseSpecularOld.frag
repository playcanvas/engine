vec3 combineColor() {
    return mix(dAlbedo * dDiffuseLight + dSpecularLight * dSpecularity, dReflection.rgb, dReflection.a);
}

