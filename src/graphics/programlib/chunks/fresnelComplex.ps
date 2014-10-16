// More physically-based Fresnel
uniform float material_fresnelFactor; // should be IOR
void getFresnel(inout psInternalData data) {
    float cosThetaI = max(dot(data.normalW, data.viewDirW), 0.0);
    float n = material_fresnelFactor;

    float cosThetaT = sqrt(max(0.0, 1.0 - (1.0 - cosThetaI * cosThetaI) / (n * n)));
    float nCosThetaT = n * cosThetaT;
    float nCosThetaI = n * cosThetaI;

    float rS = abs((cosThetaI - nCosThetaT) / (cosThetaI + nCosThetaT));
    float rP = abs((cosThetaT - nCosThetaI) / (cosThetaT + nCosThetaI));
    rS *= rS;
    rP *= rP;

    data.specularity *= (rS + rP) / 2.0;
}

