vec3 combineColor() {
    vec3 combinedSpecular = dSpecularLight * dSpecularity;

    float specularOverAlpha = getLuminance(mix(combinedSpecular, dReflection.rgb, dReflection.a));
    dAlpha = saturate(dAlpha + specularOverAlpha * specularOverAlpha);

    return mix(dAlbedo * dDiffuseLight + combinedSpecular, dReflection.rgb, dReflection.a);
}

