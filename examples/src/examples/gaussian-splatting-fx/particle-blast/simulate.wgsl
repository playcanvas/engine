// Simulates the live particles of the SceneParticlesEffect: gravity, air drag and wind, a turbulent
// flow, an optional attractor, and the collisions with the voxels. It also decides which particles
// are hidden behind the scene, by comparing their depth with the scene depth.

#include "dispatchThreadsCS"
#include "sceneDepthCS"
#include "sceneParticleCS"
#include "sceneParticleVoxelsCS"

var<storage, read_write> particles: array<SceneParticle>;

// the ring buffer slot of the oldest particle which can still be alive, and the number of slots
uniform firstParticle: u32;
uniform particleCount: u32;

uniform dt: f32;
uniform time: f32;
uniform gravity: vec3f;
uniform drag: f32;
uniform turbulence: f32;
uniform bounce: f32;
uniform friction: f32;

// the velocity of the wind, which the air drag pulls the particles toward
uniform wind: vec3f;

// the attractor: xyz its position, w its strength, zero when off, and the axis the particles
// orbit it around
uniform attractor: vec4f;
uniform attractorAxis: vec3f;

// the view projection matrix the particles render with this frame
uniform viewProjection: mat4x4f;

// Whether a particle is hidden behind the scene. The scene depth of the gaussian splats is a blend
// of the depths of the splats covering a pixel, so it is compared with a little tolerance. The
// particles are only a few pixels in size, so testing their centers is as good as testing their
// pixels.
fn hiddenByScene(position: vec3f) -> bool {
    let clip = uniform.viewProjection * vec4f(position, 1.0);
    if (clip.w <= 0.0) {
        return false;
    }
    let ndc = clip.xy / clip.w;
    if (any(abs(ndc) >= vec2f(1.0))) {
        return false;
    }
    let uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
    let texel = vec2i(uv * vec2f(sceneDepthSize()));
    return clip.w > sceneDepthLinear(texel) * 1.01 + 0.03;
}

// a turbulent flow field, made of a few octaves of rotated sine waves - cheap, smooth and swirly
fn flow(position: vec3f, t: f32) -> vec3f {
    var p = position * 1.7;
    var result = vec3f(0.0);
    var amplitude = 1.0;
    for (var octave = 0; octave < 3; octave++) {
        result += amplitude * vec3f(
            sin(p.y * 1.3 + t * 0.9 + sin(p.z * 0.7 + t * 0.3)),
            sin(p.z * 1.1 + t * 1.1 + sin(p.x * 0.9 - t * 0.4)),
            sin(p.x * 1.2 + t * 0.7 + sin(p.y * 0.8 + t * 0.5))
        );
        p = vec3f(p.y + p.z, p.z - p.x, p.x + p.y) * 1.3;
        amplitude *= 0.55;
    }
    return result;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if (!dispatchThreadInRange(id)) {
        return;
    }
    let index = (uniform.firstParticle + dispatchThreadIndex(id)) % uniform.particleCount;

    var particle = particles[index];
    if (particle.life <= 0.0) {
        return;
    }

    let dt = uniform.dt;
    particle.age += dt;
    particle.flash *= exp(-dt * 7.0);
    if (particle.age >= particle.life) {
        particle.life = 0.0;
        particles[index] = particle;
        return;
    }

    var velocity = particle.velocity;
    let seed = sceneParticleSeed(particle);
    let attracting = uniform.attractor.w > 0.0;

    // the direction the particles fall in, to come to rest on the surfaces facing against it
    let gravityLength = length(uniform.gravity);
    let down = select(vec3f(0.0), uniform.gravity / gravityLength, gravityLength > 0.0);

    // a particle which came to rest stays put, unless the attractor picks it up
    let resting = all(velocity == vec3f(0.0));
    if (!resting || attracting) {

        velocity += flow(particle.position, uniform.time) * uniform.turbulence * (0.5 + seed) * dt;

        if (attracting) {
            // The attractor steers each particle onto an orbit of its own around it, of a radius and
            // a tilt from its seed, so that they gather in a swirling ball.
            let toAttractor = uniform.attractor.xyz - particle.position;
            let distance = max(length(toAttractor), 0.01);
            let direction = toAttractor / distance;
            let tilt = vec3f(sin(seed * 91.7), sin(seed * 53.3), sin(seed * 27.1)) * 0.7;
            let axis = normalize(uniform.attractorAxis + tilt);
            let tangent = normalize(cross(axis, direction) + vec3f(0.0001));
            let orbitRadius = 0.2 + 0.5 * seed;
            let strength = uniform.attractor.w;
            let inward = clamp((distance - orbitRadius) * 4.0, -3.0, 1.0) * strength * 0.3;
            let steered = direction * inward + tangent * strength * 0.12 * (1.0 + seed);
            velocity = mix(velocity, steered, 1.0 - exp(-dt * 3.0));
        } else {
            velocity += uniform.gravity * dt;
        }

        velocity = uniform.wind + (velocity - uniform.wind) * exp(-uniform.drag * dt);

        // a particle stuck in the voxels is moved out of them
        if (voxelSolid(particle.position)) {
            particle.position += voxelNormal(particle.position, -down) * uniform.voxelSize;
        }

        // the motion is split into steps shorter than a voxel, so that the fast particles do not
        // tunnel through the thin walls
        let steps = select(1u, u32(clamp(ceil(length(velocity) * dt / (uniform.voxelSize * 0.8)), 1.0, 12.0)), voxelsEnabled());
        let h = dt / f32(steps);
        for (var s = 0u; s < steps; s++) {
            let next = particle.position + velocity * h;
            if (voxelSolid(next)) {
                var normal = voxelNormal(next, vec3f(0.0));
                var vn = dot(velocity, normal);

                // the smoothed normal can disagree with the motion, in a pit in the surface - more of
                // the voxels around are above than below. The faces of the voxels crossed decide then.
                if (vn >= 0.0) {
                    let voxelFrom = voxelOf(particle.position);
                    let voxelTo = voxelOf(next);
                    normal = vec3f(0.0);
                    if (voxelTo.x != voxelFrom.x && voxelSolidAt(vec3i(voxelTo.x, voxelFrom.y, voxelFrom.z))) {
                        normal.x = -sign(velocity.x);
                    }
                    if (voxelTo.y != voxelFrom.y && voxelSolidAt(vec3i(voxelFrom.x, voxelTo.y, voxelFrom.z))) {
                        normal.y = -sign(velocity.y);
                    }
                    if (voxelTo.z != voxelFrom.z && voxelSolidAt(vec3i(voxelFrom.x, voxelFrom.y, voxelTo.z))) {
                        normal.z = -sign(velocity.z);
                    }
                    normal = select(normalize(normal), -normalize(velocity), all(normal == vec3f(0.0)));
                    vn = dot(velocity, normal);
                }
                if (vn < 0.0) {
                    let tangent = velocity - normal * vn;
                    velocity = tangent * (1.0 - uniform.friction) - normal * vn * uniform.bounce;
                    particle.flash = max(particle.flash, min(1.0, -vn * 0.2));
                }

                // slow enough on a surface facing against the gravity, the particle comes to rest
                if (!attracting && dot(normal, -down) > 0.6 && length(velocity) < 0.25) {
                    velocity = vec3f(0.0);
                    break;
                }
            } else {
                particle.position = next;
            }
        }

        // the particles leaving the voxel grid fell out of the scene
        if (voxelsEnabled()) {
            let grid = (particle.position - uniform.voxelGridMin) / uniform.voxelSize;
            if (any(grid < vec3f(-8.0)) || any(grid > uniform.voxelGridSize + 8.0)) {
                particle.life = 0.0;
            }
        }
    }

    particle.velocity = velocity;
    particle.flags = select(particle.flags & 0xffffu, particle.flags | SCENE_PARTICLE_HIDDEN, hiddenByScene(particle.position));
    particles[index] = particle;
}
