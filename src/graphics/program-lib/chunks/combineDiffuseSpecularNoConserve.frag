vec3 combineColor() {
    vec3 combinedSpecular = (dSpecularLight + dReflection.rgb * dReflection.a) * dSpecularity;

#ifdef SPECULAROVERALPHA
    float specularOverAlpha = getLuminance(combinedSpecular);
    dAlpha = saturate(dAlpha + specularOverAlpha * specularOverAlpha);
#endif

    return dAlbedo * dDiffuseLight + combinedSpecular;
}

