vec3 combineColor() {
    vec3 combinedSpecular = dSpecularLight + dReflection.rgb * dReflection.a;
    return mix(dAlbedo * dDiffuseLight, combinedSpecular, dSpecularity);
}

