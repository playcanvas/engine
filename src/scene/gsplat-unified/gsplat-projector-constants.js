// Shared constants for the hybrid gsplat renderer's projection cache. Mirrored into WGSL via
// cdefines text substitution (e.g. `{CACHE_STRIDE}u`). Keeping this in a single place keeps
// JS-side buffer allocations and WGSL indexing in sync.
//
// Layout (raster-friendly, 8 u32 slots = 32 B per splat):
//   [0] proj.x       (f32)            — clip-space center X (viewProj * worldCenter)
//   [1] proj.y       (f32)            — clip-space center Y
//   [2] proj.z       (f32)            — clip-space center Z
//   [3] proj.w       (f32)            — clip-space homogeneous w; drives clip-space corner-scale
//                                       c = w/viewport and the rasterizer's perspective divide.
//                                       Linear view depth (used by fog / overdraw / prepass) is
//                                       reconstructed in the hybrid VS via the clipToViewZ
//                                       uniform = -inverse(matrix_projection)[row 2], which is
//                                       correct for both perspective and orthographic cameras.
//   [4] v1.xy        (pack2x16float)  — screen-pixel eigenvector × eigenvalue (axis 1)
//   [5] v2.xy        (pack2x16float)  — screen-pixel eigenvector × eigenvalue (axis 2)
//   [6] color rg     (pack2x16float)  — color channels R, G (or pcId in pick mode)
//   [7] color b + a  (pack2x16float)  — color channel B and final opacity (after AA / alpha gate)
//
// XR stereo variant (compiled with the `GSPLAT_XR` define; same 8 u32 / 32 B stride, so buffer
// sizes are unchanged). Only the per-eye screen position is duplicated; everything else is shared
// between the two eyes — valid because WebXR stereo is parallel-axis (see Renderer.updateCameraFrustum).
// Perspective-only: clip.z is NOT stored, it is reconstructed in the hybrid VS from the shared w.
//   [0,1] ndc0.xy   (f32)            — eye 0 normalized device coords (clip.xy / clip.w)
//   [2,3] ndc1.xy   (f32)            — eye 1 normalized device coords
//   [4]   w         (f32)            — shared clip-space w (= clip.w of eye 0); drives corner-scale,
//                                      depth reconstruction, and linear view depth (viewDepth = w)
//   [5]   v1.xy     (pack2x16float)  — shared screen-pixel eigenvector (axis 1, from eye 0)
//   [6]   v2.xy     (pack2x16float)  — shared screen-pixel eigenvector (axis 2)
//   [7]   color     (pack4x8unorm)   — shared RGBA8 color + opacity (XR accepts 8-bit color)

export const CACHE_STRIDE = 8;
