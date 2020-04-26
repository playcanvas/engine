vec3 combineColor() {
    vec3 combinedSpecular = dSpecularLight + dReflection.rgb * dReflection.a;

#ifdef SPECULAROVERALPHA
    float specularOverAlpha = getLuminance(combinedSpecular * dSpecularity);
    dAlpha = saturate(dAlpha + specularOverAlpha * specularOverAlpha);
#endif

    return mix(dAlbedo * dDiffuseLight, combinedSpecular, dSpecularity);
}

