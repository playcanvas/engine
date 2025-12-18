export default /* wgsl */`
fn modifyCenter(center: ptr<function, vec3f>) {
    // Modify the splat center position
    // Example: (*center).y += 1.0; // offset all splats up by 1 unit
}

fn modifyCovariance(originalCenter: vec3f, modifiedCenter: vec3f, covA: ptr<function, vec3f>, covB: ptr<function, vec3f>) {
    // Modify the splat size/covariance
    // Example to scale all splats by 2x:
    // gsplatApplyUniformScale(covA, covB, 2.0);
    //
    // Example to clamp size to a range:
    // let size = gsplatExtractSize(*covA, *covB);
    // let newSize = clamp(size, 0.01, 0.5);
    // gsplatApplyUniformScale(covA, covB, newSize / size);
    //
    // Example to make splats round/spherical:
    // let size = gsplatExtractSize(*covA, *covB);
    // gsplatMakeRound(covA, covB, size * 0.5);
    //
    // To hide a splat:
    // gsplatMakeRound(covA, covB, 0.0);
}

fn modifyColor(center: vec3f, color: ptr<function, vec4f>) {
    // Modify the splat color
    // Example: (*color) = vec4f((*color).rgb * 0.5, (*color).a); // darken all splats
}
`;
