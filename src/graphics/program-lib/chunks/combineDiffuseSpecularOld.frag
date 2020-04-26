vec3 combineColor() {
    vec3 combinedSpecular = dSpecularLight * dSpecularity;

#ifdef SPECULAROVERALPHA
    float specularOverAlpha = getLuminance(mix(combinedSpecular, dReflection.rgb, dReflection.a));
    dAlpha = saturate(dAlpha + specularOverAlpha * specularOverAlpha);
#endif

    return mix(dAlbedo * dDiffuseLight + combinedSpecular, dReflection.rgb, dReflection.a);
}

