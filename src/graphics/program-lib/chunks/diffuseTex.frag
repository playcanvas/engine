uniform sampler2D texture_diffuseMap;
void getAlbedo() {
    dAlbedo = texture2DSRGB(texture_diffuseMap, $UV).$CH;
}

