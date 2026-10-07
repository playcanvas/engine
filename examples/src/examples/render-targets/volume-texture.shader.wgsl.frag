#include "gammaPS"
#include "screenDepthPS"

// rgb: fog color, a: fog density
var uVolume: texture_3d<f32>;
var uVolumeSampler: sampler;

// the world space bounds of the volume
uniform uBoxMin: vec3f;
uniform uBoxMax: vec3f;

uniform uDensity: f32;
uniform uBrightness: f32;
uniform view_position: vec3f;

varying vFarPosition: vec3f;

// number of samples along the part of the ray inside the volume
const STEPS: i32 = 64;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let rayDir = normalize(input.vFarPosition - uniform.view_position);

    // distance to the scene geometry along the ray, from its linear depth
    let view = uniform.matrix_view;
    let cameraForward = -vec3f(view[0][2], view[1][2], view[2][2]);
    let sceneDistance = getLinearScreenDepthFrag() / dot(rayDir, cameraForward);

    // the part of the ray inside the volume box, in front of the scene geometry
    let invDir = 1.0 / rayDir;
    let t0 = (uniform.uBoxMin - uniform.view_position) * invDir;
    let t1 = (uniform.uBoxMax - uniform.view_position) * invDir;
    let tMin = min(t0, t1);
    let tMax = max(t0, t1);
    let tEnter = max(max(max(tMin.x, tMin.y), tMin.z), 0.0);
    let tExit = min(min(min(tMax.x, tMax.y), tMax.z), sceneDistance);
    if (tExit <= tEnter) {
        discard;
        return output;
    }

    // march the ray front to back, starting with a per pixel jitter to hide the banding
    let stepLength = (tExit - tEnter) / f32(STEPS);
    let jitter = fract(52.9829189 * fract(dot(pcPosition.xy, vec2f(0.06711056, 0.00583715))));
    let boxSize = uniform.uBoxMax - uniform.uBoxMin;
    var color = vec3f(0.0);
    var transmittance = 1.0;
    for (var i = 0; i < STEPS; i++) {
        let t = tEnter + (f32(i) + jitter) * stepLength;
        let uvw = (uniform.view_position + rayDir * t - uniform.uBoxMin) / boxSize;
        let voxel = textureSampleLevel(uVolume, uVolumeSampler, uvw, 0.0);
        let alpha = 1.0 - exp(-voxel.a * uniform.uDensity * stepLength);
        color += transmittance * alpha * voxel.rgb;
        transmittance *= 1.0 - alpha;
    }

    // premultiplied alpha output
    output.color = vec4f(gammaCorrectOutput(color * uniform.uBrightness), 1.0 - transmittance);
    return output;
}
