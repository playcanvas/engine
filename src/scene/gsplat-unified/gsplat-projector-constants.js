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

export const CACHE_STRIDE = 8;
