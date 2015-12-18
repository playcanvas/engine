// Schlick's approximation
uniform float material_fresnelFactor; // unused
void getFresnel(inout psInternalData data) {
    float fresnel = 1.0 - max(dot(data.normalW, data.viewDirW), 0.0);
    float fresnel2 = fresnel * fresnel;
    fresnel *= fresnel2 * fresnel2;
    fresnel *= data.glossiness * data.glossiness;
    data.specularity = data.specularity + (1.0 - data.specularity) * fresnel;
}

