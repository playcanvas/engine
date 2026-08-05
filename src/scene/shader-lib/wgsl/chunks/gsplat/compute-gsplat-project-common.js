// Shared per-splat load + projection gate for compute GSplat paths.
//
// This chunk intentionally declares no bindings or uniforms. Callers provide
// compactedSplatIds and include the format/read chunks before including this
// helper.

export const computeGsplatProjectCommonSource = /* wgsl */`

struct ProjectedSplatCommon {
    valid: bool,
    splatId: u32,
    center: vec3f,
    opacity: f32,
    proj: SplatCov2D
}

fn invalidProjectedSplatCommon() -> ProjectedSplatCommon {
    var cov: SplatCov2D;
    cov.screen = vec2f(0.0);
    cov.a = 0.0;
    cov.b = 0.0;
    cov.c = 0.0;
    cov.viewDepth = 0.0;
    cov.valid = false;

    return ProjectedSplatCommon(false, 0u, vec3f(0.0), 0.0, cov);
}

fn projectSplatCommon(
    threadIdx: u32,
    numVisible: u32,
    alphaClip: f32,
    minPixelSize: f32,
    minContribution: f32,
    foveationStrength: f32,
    foveationCenter: f32,
    viewMatrix: mat4x4f,
    viewProj: mat4x4f,
    focal: f32,
    viewportWidth: f32,
    viewportHeight: f32,
    nearClip: f32,
    farClip: f32,
    isOrtho: u32,
    #ifdef GSPLAT_FISHEYE
        fisheye_k: f32,
        fisheye_inv_k: f32,
        fisheye_projMat00: f32,
        fisheye_projMat11: f32,
    #endif
    #ifdef GSPLAT_XR
        viewProj1: mat4x4f,
    #endif
) -> ProjectedSplatCommon {
    if (threadIdx >= numVisible) {
        return invalidProjectedSplatCommon();
    }

    let splatId = compactedSplatIds[threadIdx];
    setSplat(splatId);

    // read the world-space center and apply the render-stage center modifier before projection
    // (matches the quad renderer's gsplatVS, which calls modifySplatCenter on the model center)
    let originalCenter = getCenter();
    var center = originalCenter;
    modifySplatCenter(&center);

    let opacity = getOpacity();
    if (opacity <= alphaClip) {
        return invalidProjectedSplatCommon();
    }

    // apply the render-stage rotation/scale modifier (e.g. scale-to-zero for reveal/hide effects).
    // getRotation() is (w,x,y,z); the modify hook contract is (x,y,z,w) and computeSplatCov expects
    // (w,x,y,z) - this mirrors gsplatCorner.js in the quad renderer.
    var rotation: vec4f = getRotation().yzwx;
    var scale: vec3f = getScale();
    modifySplatRotationScale(originalCenter, center, &rotation, &scale);

    let proj = computeSplatCov(
        center, half4(rotation.wxyz), half3(scale),
        viewMatrix, viewProj,
        focal, viewportWidth, viewportHeight,
        nearClip, farClip, opacity, minPixelSize,
        isOrtho, alphaClip, minContribution,
        foveationStrength, foveationCenter,
        #ifdef GSPLAT_FISHEYE
            fisheye_k, fisheye_inv_k,
            fisheye_projMat00, fisheye_projMat11,
        #endif
        #ifdef GSPLAT_XR
            viewProj1,
        #endif
    );

    if (!proj.valid) {
        return invalidProjectedSplatCommon();
    }

    return ProjectedSplatCommon(true, splatId, center, opacity, proj);
}
`;

export default computeGsplatProjectCommonSource;
