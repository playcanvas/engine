// Compute shader for interval-based culling and counting.
//
// Each thread processes one interval, performs a visibility test (reading bounding
// spheres and transforms from storage buffers), and writes the interval's splat
// count (or 0 if culled) into a count buffer.
//
// GSPLAT_FISHEYE: cone-based culling using camera position, forward direction
// and maximum visible angle (supports wide-angle and behind-camera rendering).
// Default: sphere-vs-frustum test using 6 frustum planes.
//
// After an exclusive prefix sum over numIntervals + 1 elements:
//   - prefixSum[i] gives the output offset for interval i's splats
//   - prefixSum[numIntervals] equals the total visible splat count

export const computeGsplatIntervalCullSource = /* wgsl */`

struct Interval {
    workBufferBase: u32,
    splatCount: u32,
    boundsIndex: u32,
    pad: u32
};

struct BoundsEntry {
    centerX: f32,
    centerY: f32,
    centerZ: f32,
    radius: f32,
    transformIndex: u32,
    pad0: u32,
    pad1: u32,
    pad2: u32
};

struct CullUniforms {
#ifdef GSPLAT_FISHEYE
    cameraWorldPos: vec3f,
    maxTheta: f32,
    cameraForward: vec3f,
    numIntervals: u32,
#else
    frustumPlanes: array<vec4f, 6>,
    numIntervals: u32
#endif
};

@group(0) @binding(0) var<uniform> uniforms: CullUniforms;

@group(0) @binding(1) var<storage, read> intervals: array<Interval>;

@group(0) @binding(2) var<storage, read_write> countBuffer: array<u32>;

@group(0) @binding(3) var<storage, read> boundsBuffer: array<BoundsEntry>;
@group(0) @binding(4) var<storage, read> transformsBuffer: array<vec4f>;

@compute @workgroup_size({WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let idx = gid.x;
    if (idx < uniforms.numIntervals) {
        let interval = intervals[idx];

        let entry = boundsBuffer[interval.boundsIndex];
        let localCenter = vec3f(entry.centerX, entry.centerY, entry.centerZ);
        let radius = entry.radius;

        let base = entry.transformIndex * 3u;
        let row0 = transformsBuffer[base];
        let row1 = transformsBuffer[base + 1u];
        let row2 = transformsBuffer[base + 2u];

        let worldCenter = vec3f(
            dot(vec4f(localCenter, 1.0), row0),
            dot(vec4f(localCenter, 1.0), row1),
            dot(vec4f(localCenter, 1.0), row2)
        );

        let worldRadius = radius * length(vec3f(row0.x, row1.x, row2.x));

    #ifdef GSPLAT_FISHEYE
        let v = worldCenter - uniforms.cameraWorldPos;
        let d = length(v);
        var visible = true;
        if (d > worldRadius) {
            let cosAngle = dot(v / d, uniforms.cameraForward);
            let theta = acos(clamp(cosAngle, -1.0, 1.0));
            let angularRadius = asin(min(worldRadius / d, 1.0));
            visible = (theta - angularRadius) < uniforms.maxTheta;
        }
    #else
        var visible = true;
        for (var p = 0; p < 6; p++) {
            let plane = uniforms.frustumPlanes[p];
            let dist = dot(plane.xyz, worldCenter) + plane.w;
            if (dist <= -worldRadius) {
                visible = false;
                break;
            }
        }
    #endif

        countBuffer[idx] = select(0u, interval.splatCount, visible);
    }

    // Thread 0 writes sentinel so prefixSum[numIntervals] = total visible count
    if (idx == 0u) {
        countBuffer[uniforms.numIntervals] = 0u;
    }
}
`;

export default computeGsplatIntervalCullSource;
