vec3 combineColor() {
    vec3 combinedSpecular = (dSpecularLight + dReflection.rgb * dReflection.a) * dSpecularity;

    float specularOverAlpha = getLuminance(combinedSpecular);
    dAlpha = saturate(dAlpha + specularOverAlpha * specularOverAlpha);

    return dAlbedo * dDiffuseLight + combinedSpecular;
}

