export default /* glsl */`

void addReflectionSheen(Frontend frontend) {
    float NoV = dot(frontend.worldNormal, dViewDirW);
    float alphaG = frontend.sheenGlossiness * frontend.sheenGlossiness;

    // Avoid using a LUT and approximate the values analytically
    float a = frontend.sheenGlossiness < 0.25 ? -339.2 * alphaG + 161.4 * frontend.sheenGlossiness - 25.9 : -8.48 * alphaG + 14.3 * frontend.sheenGlossiness - 9.95;
    float b = frontend.sheenGlossiness < 0.25 ? 44.0 * alphaG - 23.7 * frontend.sheenGlossiness + 3.26 : 1.97 * alphaG - 3.27 * frontend.sheenGlossiness + 0.72;
    float DG = exp( a * NoV + b ) + ( frontend.sheenGlossiness < 0.25 ? 0.0 : 0.1 * ( frontend.sheenGlossiness - 0.25 ) );
    sReflection += calcReflection(frontend.worldNormal, 0.0) * saturate(DG);
}
`;
