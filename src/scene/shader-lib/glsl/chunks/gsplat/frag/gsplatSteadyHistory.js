export default /* glsl */`
void main(void) {
    ivec2 p = ivec2(gl_FragCoord.xy);
    uvec4 sampleData = texelFetch(steadySamples, p, 0);
    uvec4 entries[4];
    bool duplicate = false;
    for (int k = 0; k < 4; k++) {
        entries[k] = steadyEntryAt(p, k);
        duplicate = duplicate || (sampleData.x != 0u && entries[k].x == sampleData.x);
    }
    if (sampleData.x != 0u && !duplicate) {
        for (int k = 3; k > 0; k--) entries[k] = entries[k - 1];
        vec4 ratio = vec4(1.0);
        if (sampleData.x != 0u) {
            vec4 gaussian = texelFetch(steadyGaussians, p, 0);
            float alpha = steadyAlpha(gaussian, uintBitsToFloat(sampleData.zw), vec2(p) + 0.5);
            ratio = (1.0 - steadyNeighborAlphas(p, sampleData, gaussian)) / max(1.0 - alpha, 1e-6);
        }
        entries[0] = uvec4(sampleData.xy, packHalf2x16(ratio.xy), packHalf2x16(ratio.zw));
    }
    pcFragColor0 = entries[0];
    pcFragColor1 = entries[1];
    pcFragColor2 = entries[2];
    pcFragColor3 = entries[3];
}
`;
