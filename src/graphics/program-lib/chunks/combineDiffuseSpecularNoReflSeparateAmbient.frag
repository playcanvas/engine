uniform vec3 material_ambient;
vec3 combineColor() {
    vec3 combinedSpecular = dSpecularLight * dSpecularity;
    return (dDiffuseLight - light_globalAmbient) * dAlbedo + combinedSpecular + material_ambient * light_globalAmbient;
}

