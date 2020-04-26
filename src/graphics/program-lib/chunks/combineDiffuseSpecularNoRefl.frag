vec3 combineColor() {
    vec3 combinedSpecular = dSpecularLight * dSpecularity;

#ifdef SPECULAROVERALPHA
    float specularOverAlpha = getLuminance(combinedSpecular);
    dAlpha = saturate(dAlpha + specularOverAlpha * specularOverAlpha);
#endif

    return dAlbedo * dDiffuseLight + combinedSpecular;
}

