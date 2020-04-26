vec3 combineColor() {
    vec3 combinedSpecular = dSpecularLight + dReflection.rgb * dReflection.a;

    float specularOverAlpha = getLuminance(combinedSpecular * dSpecularity);
    dAlpha = saturate(dAlpha + specularOverAlpha * specularOverAlpha);

    return mix(dAlbedo * dDiffuseLight, combinedSpecular, dSpecularity);
}

