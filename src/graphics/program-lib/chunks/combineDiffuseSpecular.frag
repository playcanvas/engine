vec3 combineColor() {
    // NB energy conservation has changed with half-angle fresnel  
    return dAlbedo * dDiffuseLight + dSpecularLight + dReflection.rgb * dReflection.a;
}
