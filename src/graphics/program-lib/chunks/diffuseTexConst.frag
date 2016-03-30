uniform sampler2D texture_diffuseMap;
uniform vec3 material_diffuse;
void getAlbedo() {
    dAlbedo = texture2DSRGB(texture_diffuseMap, $UV).$CH * material_diffuse;
}

