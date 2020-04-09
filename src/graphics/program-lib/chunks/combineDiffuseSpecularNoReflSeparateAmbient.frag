uniform vec3 material_ambient;
vec3 combineColor() {
    return (dDiffuseLight - light_globalAmbient) * dAlbedo + dSpecularLight * dSpecularity + material_ambient * light_globalAmbient;
}

