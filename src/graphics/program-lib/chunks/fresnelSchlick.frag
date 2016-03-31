// Schlick's approximation
uniform float material_fresnelFactor; // unused
void getFresnel() {
    float fresnel = 1.0 - max(dot(dNormalW, dViewDirW), 0.0);
    float fresnel2 = fresnel * fresnel;
    fresnel *= fresnel2 * fresnel2;
    fresnel *= dGlossiness * dGlossiness;
    dSpecularity = dSpecularity + (1.0 - dSpecularity) * fresnel;
}

