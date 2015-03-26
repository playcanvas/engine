uniform vec3 material_ambient;
vec3 combineColor(inout psInternalData data) {
    return (data.diffuseLight - light_globalAmbient) * data.albedo + data.specularLight * data.specularity + material_ambient * light_globalAmbient;
}

