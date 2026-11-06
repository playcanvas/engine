// Spawns the particles of the SceneParticlesEffect from the pixels of the emissions of the frame.
// It runs right after the scene renders, so it reads this frame's scene: each particle takes the
// color of a pixel, and starts at the world position the scene depth reconstructs for it. The
// particles render after this, so they are not in the scene it reads - else they would spawn
// particles of their own glowing color, which would get brighter generation after generation.

#include "dispatchThreadsCS"
#include "sceneDepthCS"
#include "sceneParticleCS"
#include "sceneParticleVoxelsCS"

// the scene color the camera frame rendered, linear HDR
var sceneColor: texture_2d<uff>;

var<storage, read_write> particles: array<SceneParticle>;

// the ring buffer slot of the first spawned particle, and the number of slots
uniform spawnStart: u32;
uniform particleCount: u32;

// a different seed every frame
uniform frameSeed: u32;

// The emissions of the frame, each a circle of the scene the particles spawn from: xy its center
// and z its radius, in texels, and w the number of the spawned particles up to its end.
uniform emissions: array<vec4f, 16>;
uniform emissionCount: u32;

uniform cameraPosition: vec3f;

// the world size of a texel at the distance of one unit from the camera
uniform texelSize: f32;

uniform speed: f32;
uniform spread: f32;
uniform lifetime: f32;
uniform size: f32;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if (!dispatchThreadInRange(id)) {
        return;
    }
    let thread = dispatchThreadIndex(id);
    let index = (uniform.spawnStart + thread) % uniform.particleCount;
    var rng = hash(thread ^ hash(uniform.frameSeed));

    // the emission of the thread
    var emission = uniform.emissions[0];
    for (var e = 0u; e < uniform.emissionCount; e++) {
        emission = uniform.emissions[e];
        if (f32(thread) < emission.w) {
            break;
        }
    }
    let emitCenter = emission.xy;
    let emitRadius = emission.z;

    // the world position at the center of the emission, which the particles blast away from
    let size = vec2i(sceneDepthSize());
    let centerTexel = clamp(vec2i(emitCenter), vec2i(0), size - 1);
    let center = sceneDepthWorldPosition(centerTexel);

    var particle: SceneParticle;
    particle.life = 0.0;

    // a few attempts at finding a pixel to spawn from, skipping those outside the screen and the
    // pixels with nothing rendered to them
    for (var attempt = 0; attempt < 4; attempt++) {
        let r = emitRadius * sqrt(random(&rng));
        let angle = random(&rng) * 6.2831853;
        let texel = vec2i(emitCenter + vec2f(cos(angle), sin(angle)) * r);
        if (any(texel < vec2i(0)) || any(texel >= size)) {
            continue;
        }

        let color = textureLoad(sceneColor, texel, 0);
        let depth = sceneDepthLinear(texel);
        if (depth > sceneDepthFarClip() * 0.9) {
            continue;
        }

        // The surface is where the scene is, which is inside the solid voxels covering it - move
        // toward the camera until out of them, so that the particle does not start stuck.
        var position = sceneDepthWorldPosition(texel);
        let toCamera = normalize(uniform.cameraPosition - position);
        var free = false;
        for (var step = 0; step < 16; step++) {
            if (!voxelSolid(position)) {
                free = true;
                break;
            }
            position += toCamera * uniform.voxelSize * 0.5;
        }
        if (!free) {
            continue;
        }

        // the particles leave the surface along its normal, blasted away from the center of the
        // emission, and scattered a little. Without voxels, the surface faces the camera.
        var normal = voxelNormal(position - toCamera * uniform.voxelSize, toCamera);
        normal = normalize(select(normal, toCamera, dot(normal, toCamera) < 0.0));
        let offset = position - center;
        let radial = offset - normal * dot(offset, normal);
        let radialLength = length(radial);
        let outward = select(vec3f(0.0), radial / radialLength, radialLength > 0.0001);
        let falloff = r / max(emitRadius, 1.0);
        let direction = normalize(
            normal +
            outward * uniform.spread * (0.4 + falloff) +
            randomDirection(&rng) * (0.25 + 0.35 * uniform.spread)
        );

        // faster at the center of the emission
        let particleSpeed = uniform.speed * mix(0.35, 1.0, random(&rng)) * (1.25 - 0.5 * falloff);

        // a particle covers about the pixel it was spawned from, so the surface itself seems to
        // come apart
        let radius = clamp(depth * uniform.texelSize * uniform.size * mix(0.6, 1.4, random(&rng)), 0.002, 0.05);
        let rgb = min(color.rgb, vec3f(4.0));

        particle.position = position;
        particle.age = 0.0;
        particle.velocity = direction * particleSpeed;
        particle.life = uniform.lifetime * mix(0.5, 1.0, random(&rng));
        particle.colorRG = pack2x16float(rgb.rg);
        particle.colorBRadius = pack2x16float(vec2f(rgb.b, radius));
        particle.flash = 0.0;
        particle.flags = hash(rng) & 0xffffu;
        break;
    }

    particles[index] = particle;
}
