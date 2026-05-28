// Single-pass projector for the hybrid GSplat renderer.
//
// For each visible splat (compactedSplatIds[threadIdx]) this pass:
//   1. Projects the splat to clip + screen space (computeSplatCov), applying the same
//      alpha / minPixelSize / minContribution / off-screen culls used by the compute renderer.
//   2. Derives the eigen-vectors v1, v2 (same eigen-decomposition as gsplatCorner.js).
//   3. Computes a depth-based sort key (camera-relative bin weighting; matches CPU worker sort keys,
//      optionally radial via RADIAL_SORT define).
//   4. Workgroup-local atomic compaction: each thread that survives culling gets a slot
//      via a shared atomic, then the workgroup leader reserves a contiguous range in the
//      global renderCounter. This caps global atomics at one per workgroup.
//   5. Writes the 8 u32 slots of the projection cache and the sort key.
//
// Bindings 0..6 are fixed; texture bindings for the work-buffer format follow them
// (injected via gsplatFormatDeclCS, starting at binding {FIXED_BINDINGS_LEN}).
//
// 3DGS only. Fisheye is supported via the GSPLAT_FISHEYE define: when enabled
// the projector writes (ndc.x, ndc.y, depthNdc, 1.0) into the cache (matching
// gsplatCenter.js) and the hybrid VS reconstructs linear view depth from clip
// via clipToViewZ = (0, 0, far - near, near). For perspective + orthographic
// the projector keeps writing real clipPos and the VS uses the
// inverse-projection-derived clipToViewZ.
export const computeGsplatProjectorSource = /* wgsl */`

#include "gsplatCommonCS"
#include "gsplatTileIntersectCS"

@group(0) @binding(0) var<storage, read> compactedSplatIds: array<u32>;
@group(0) @binding(1) var<storage, read> sortElementCount: array<u32>;
@group(0) @binding(2) var<storage, read_write> projCache: array<u32>;
@group(0) @binding(3) var<storage, read_write> sortKeys: array<u32>;
@group(0) @binding(4) var<storage, read_write> renderCounter: array<atomic<u32>>;

// Camera-relative bin weighting for sort key computation (32 entries of {base, divider}).
struct BinWeight {
    base: f32,
    divider: f32
}
@group(0) @binding(5) var<storage, read> binWeights: array<BinWeight>;

struct ProjectorUniforms {
    splatTextureSize: u32,
    numBins: u32,
    isOrtho: u32,
    pad0: u32,
    viewProj: mat4x4f,
    viewMatrix: mat4x4f,
    cameraPosition: vec3f,
    minPixelSize: f32,
    cameraDirection: vec3f,
    focal: f32,
    viewportWidth: f32,
    viewportHeight: f32,
    nearClip: f32,
    farClip: f32,
    alphaClip: f32,
    minContribution: f32,
    minDist: f32,
    invRange: f32,
    #ifdef GSPLAT_FISHEYE
        fisheye_k: f32,
        fisheye_inv_k: f32,
        fisheye_projMat00: f32,
        fisheye_projMat11: f32,
    #endif
}
@group(0) @binding(6) var<uniform> uniforms: ProjectorUniforms;

#include "gsplatComputeSplatCS"
#include "gsplatFormatDeclCS"
#include "gsplatFormatReadCS"
#include "gsplatProjectCommonCS"

// One global atomicAdd per workgroup (256 threads) — drastically lowers contention
// vs a per-thread atomic on the global counter without needing subgroup ops.
var<workgroup> wgCount: atomic<u32>;
var<workgroup> wgBase: u32;

@compute @workgroup_size(256)
fn main(
    @builtin(global_invocation_id) gid: vec3u,
    @builtin(num_workgroups) numWorkgroups: vec3u,
    @builtin(local_invocation_index) localIdx: u32
) {
    if (localIdx == 0u) {
        atomicStore(&wgCount, 0u);
    }
    workgroupBarrier();

    // Match the indirect dispatch linearisation used by compute-gsplat-local-tile-count.js:
    // a 2D grid expanded into a flat thread index.
    let threadIdx = gid.y * (numWorkgroups.x * 256u) + gid.x;
    let numVisible = sortElementCount[0];

    var valid = false;
    var clipPos: vec4f = vec4f(0.0);
    var v1: vec2f = vec2f(0.0);
    var v2: vec2f = vec2f(0.0);
    var rgb: vec3f = vec3f(0.0);
    var alpha: f32 = 0.0;
    var pcId: u32 = 0u;
    var sortKey: u32 = 0u;

    let projected = projectSplatCommon(
        threadIdx,
        numVisible,
        uniforms.alphaClip,
        uniforms.minPixelSize,
        uniforms.minContribution,
        uniforms.viewMatrix,
        uniforms.viewProj,
        uniforms.focal,
        uniforms.viewportWidth,
        uniforms.viewportHeight,
        uniforms.nearClip,
        uniforms.farClip,
        uniforms.isOrtho,
        #ifdef GSPLAT_FISHEYE
            uniforms.fisheye_k,
            uniforms.fisheye_inv_k,
            uniforms.fisheye_projMat00,
            uniforms.fisheye_projMat11,
        #endif
    );

    if (projected.valid) {
        let center = projected.center;
        let opacity = projected.opacity;
        let proj = projected.proj;

        // Eigen-decomposition matches gsplatCorner.js initCornerCov: derives the two
        // screen-pixel eigen-vectors of the 2D screen-space covariance.
        let mid = 0.5 * (proj.a + proj.c);
        let radius = length(vec2f(0.5 * (proj.a - proj.c), proj.b));
        let lambda1 = mid + radius;
        let lambda2 = max(mid - radius, 0.1);

        // capScale was already applied to a, b, c inside computeSplatCov so the
        // eigenvalues here are already in the radius-capped space. The vmin
        // saturation mirrors gsplatCorner.js (line 89-90) for hard parity with
        // the existing rasterizer when capScale > 1.
        let vmin = min(1024.0, min(uniforms.viewportWidth, uniforms.viewportHeight));
        let l1 = 2.0 * min(sqrt(2.0 * lambda1), vmin);
        let l2 = 2.0 * min(sqrt(2.0 * lambda2), vmin);

        let dir = normalize(vec2f(proj.b, lambda1 - proj.a));
        v1 = l1 * dir;
        v2 = l2 * vec2f(dir.y, -dir.x);

        // Clip-space center. The hybrid VS uses clipPos.w directly for both
        // output.position.w (rasterizer correctness) and corner scale, and
        // reconstructs linear view depth from clipPos via the clipToViewZ uniform.
        #ifdef GSPLAT_FISHEYE
            // Fisheye: invert the screen→pixel mapping done by computeSplatCov to recover
            // NDC, then store NDC + linear depthNdc with w=1.0 (matches gsplatCenter.js).
            // The rasterizer's perspective divide is a no-op (w=1), so output.position is
            // NDC directly. The VS recovers linear -view.z via clipToViewZ = (0, 0, far-near, near).
            let viewCenter = uniforms.viewMatrix * vec4f(center, 1.0);
            let neg_z = -viewCenter.z;
            let ndcX = proj.screen.x / uniforms.viewportWidth * 2.0 - 1.0;
            let ndcY = proj.screen.y / uniforms.viewportHeight * 2.0 - 1.0;
            let depthNdc = clamp(
                (neg_z - uniforms.nearClip) / (uniforms.farClip - uniforms.nearClip),
                0.0, 1.0
            );
            clipPos = vec4f(ndcX, ndcY, depthNdc, 1.0);
        #else
            clipPos = uniforms.viewProj * vec4f(center, 1.0);
            clipPos.z = clamp(clipPos.z, 0.0, abs(clipPos.w));
        #endif

        // Sort key — shared depth-bin weighting (same as CPU worker).
        #ifdef RADIAL_SORT
            let delta = center - uniforms.cameraPosition;
            let radialDist = length(delta);
            let dist = (1.0 / uniforms.invRange) - radialDist - uniforms.minDist;
        #else
            let toSplat = center - uniforms.cameraPosition;
            let dist = dot(toSplat, uniforms.cameraDirection) - uniforms.minDist;
        #endif
        let d = dist * uniforms.invRange * f32(uniforms.numBins);
        let binFloat = clamp(d, 0.0, f32(uniforms.numBins) - 0.001);
        let bin = u32(binFloat);
        let binFrac = binFloat - f32(bin);
        sortKey = u32(binWeights[bin].base + binWeights[bin].divider * binFrac);

        #ifdef PICK_MODE
            pcId = loadPcId().r;
            alpha = opacity;
        #else
            let color = getColor();
            rgb = max(color, vec3f(0.0));
            alpha = opacity;
        #endif

        valid = true;
    }

    // Reserve a per-workgroup slot for this thread.
    var localDst: u32 = 0u;
    if (valid) {
        localDst = atomicAdd(&wgCount, 1u);
    }
    workgroupBarrier();

    // Workgroup leader reserves a contiguous output range in renderCounter[0].
    if (localIdx == 0u) {
        let total = atomicLoad(&wgCount);
        wgBase = atomicAdd(&renderCounter[0], total);
    }
    workgroupBarrier();

    if (valid) {
        let dst = wgBase + localDst;
        let base = dst * {CACHE_STRIDE}u;

        projCache[base + 0u] = bitcast<u32>(clipPos.x);
        projCache[base + 1u] = bitcast<u32>(clipPos.y);
        projCache[base + 2u] = bitcast<u32>(clipPos.z);
        projCache[base + 3u] = bitcast<u32>(clipPos.w);
        projCache[base + 4u] = pack2x16float(v1);
        projCache[base + 5u] = pack2x16float(v2);

        #ifdef PICK_MODE
            projCache[base + 6u] = pcId;
            projCache[base + 7u] = pack2x16float(vec2f(0.0, alpha));
        #else
            projCache[base + 6u] = pack2x16float(vec2f(rgb.x, rgb.y));
            projCache[base + 7u] = pack2x16float(vec2f(rgb.z, alpha));
        #endif

        sortKeys[dst] = sortKey;
    }
}
`;

export default computeGsplatProjectorSource;
