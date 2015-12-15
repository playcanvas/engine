vec3 combineColor(inout psInternalData data) {
    return mix(data.albedo * data.diffuseLight, data.specularLight + data.reflection.rgb * data.reflection.a, data.specularity);
}

