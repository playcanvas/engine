// Schlick's approximation
uniform LMEDP float material_fresnelFactor; // unused

void getFresnel() {
    LMEDP float fresnel = 1.0 - max(dot(dNormalW, dViewDirW), 0.0);
    LMEDP float fresnel2 = fresnel * fresnel;
    fresnel *= fresnel2 * fresnel2;
    fresnel *= dGlossiness * dGlossiness;
    dSpecularity = dSpecularity + (1.0 - dSpecularity) * fresnel;

    #ifdef CLEARCOAT
    fresnel = 1.0 - max(dot(ccNormalW, dViewDirW), 0.0);
    fresnel2 = fresnel * fresnel;
    fresnel *= fresnel2 * fresnel2;
    fresnel *= ccGlossiness * ccGlossiness;
    ccSpecularity = ccSpecularity + (1.0 - ccSpecularity) * fresnel;
    #endif
}
