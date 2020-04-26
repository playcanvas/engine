vec3 combineColor() {
    vec3 combinedSpecular = dSpecularLight * dSpecularity;

    float specularOverAlpha = getLuminance(combinedSpecular);
    dAlpha = saturate(dAlpha + specularOverAlpha * specularOverAlpha);

    return dAlbedo * dDiffuseLight + combinedSpecular;
}

