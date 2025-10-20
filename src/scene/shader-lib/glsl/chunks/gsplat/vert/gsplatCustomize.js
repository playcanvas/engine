export default /* glsl */`
void modifyCenter(inout vec3 center) {
    // Modify the splat center position
    // Example: center.y += 1.0; // offset all splats up by 1 unit
}

void modifyCovariance(vec3 originalCenter, vec3 modifiedCenter, inout vec3 covA, inout vec3 covB) {
    // Modify the splat size/covariance
    // Example to scale all splats by 2x:
    // gsplatApplyUniformScale(covA, covB, 2.0);
    //
    // Example to clamp size to a range:
    // float size = gsplatExtractSize(covA, covB);
    // float newSize = clamp(size, 0.01, 0.5);
    // gsplatApplyUniformScale(covA, covB, newSize / size);
}

void modifyColor(vec3 center, inout vec4 color) {
    // Modify the splat color
    // Example: color.rgb *= 0.5; // darken all splats
}
`;
