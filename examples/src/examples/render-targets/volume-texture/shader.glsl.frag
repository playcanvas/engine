#include "gammaPS"
#include "screenDepthPS"

// rgb: fog color, a: fog density
uniform mediump sampler3D uVolume;

// the world space bounds of the volume
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;

uniform float uDensity;
uniform float uBrightness;

// the mip level of the volume to sample
uniform float uLod;
uniform vec3 view_position;

varying vec3 vFarPosition;

// number of samples along the part of the ray inside the volume
#define STEPS 64

void main(void)
{
    vec3 rayDir = normalize(vFarPosition - view_position);

    // distance to the scene geometry along the ray, from its linear depth
    vec3 cameraForward = -vec3(matrix_view[0][2], matrix_view[1][2], matrix_view[2][2]);
    float sceneDistance = getLinearScreenDepth() / dot(rayDir, cameraForward);

    // the part of the ray inside the volume box, in front of the scene geometry
    vec3 invDir = 1.0 / rayDir;
    vec3 t0 = (uBoxMin - view_position) * invDir;
    vec3 t1 = (uBoxMax - view_position) * invDir;
    vec3 tMin = min(t0, t1);
    vec3 tMax = max(t0, t1);
    float tEnter = max(max(max(tMin.x, tMin.y), tMin.z), 0.0);
    float tExit = min(min(min(tMax.x, tMax.y), tMax.z), sceneDistance);
    if (tExit <= tEnter) {
        discard;
    }

    // march the ray front to back, starting with a per pixel jitter to hide the banding
    float stepLength = (tExit - tEnter) / float(STEPS);
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 boxSize = uBoxMax - uBoxMin;
    vec3 color = vec3(0.0);
    float transmittance = 1.0;
    for (int i = 0; i < STEPS; i++) {
        float t = tEnter + (float(i) + jitter) * stepLength;
        vec3 uvw = (view_position + rayDir * t - uBoxMin) / boxSize;
        // the depth slices of the volume are stacked along the height
        vec4 voxel = textureLod(uVolume, uvw.xzy, uLod);
        float alpha = 1.0 - exp(-voxel.a * uDensity * stepLength);
        color += transmittance * alpha * voxel.rgb;
        transmittance *= 1.0 - alpha;
    }

    // premultiplied alpha output
    gl_FragColor = vec4(gammaCorrectOutput(color * uBrightness), 1.0 - transmittance);
}
