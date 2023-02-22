export default /* glsl */`

void addReflectionSheen(Frontend frontend) {
    float NoV = dot(dNormalW, dViewDirW);
    float alphaG = frontend.sGlossiness * frontend.sGlossiness;

    // Avoid using a LUT and approximate the values analytically
    float a = frontend.sGlossiness < 0.25 ? -339.2 * alphaG + 161.4 * frontend.sGlossiness - 25.9 : -8.48 * alphaG + 14.3 * frontend.sGlossiness - 9.95;
    float b = frontend.sGlossiness < 0.25 ? 44.0 * alphaG - 23.7 * frontend.sGlossiness + 3.26 : 1.97 * alphaG - 3.27 * frontend.sGlossiness + 0.72;
    float DG = exp( a * NoV + b ) + ( frontend.sGlossiness < 0.25 ? 0.0 : 0.1 * ( frontend.sGlossiness - 0.25 ) );
    sReflection += calcReflection(dNormalW, 0.0) * saturate(DG);
}
`;
