// sphere struct used for the colliders
struct Sphere {
    center: vec3<f32>,
    radius: f32
}

// Simplified-syntax resources (no @group/@binding) - the engine reflects these into a bind group
// automatically, so the example does not provide computeBindGroupFormat / computeUniformBufferFormats.
// The loose uniforms are collapsed into a single generated uniform buffer.
uniform count: u32;              // number of particles
uniform dt: f32;                 // delta time
uniform sphereCount: u32;        // number of spheres

var<storage, read_write> particles: array<Particle>;
var<storage, read> spheres: array<Sphere>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_invocation_id: vec3u) {

    // particle index - ignore if out of bounds (as they get batched into groups of 64)
    let index = global_invocation_id.x * 1024 + global_invocation_id.y;
    if (index >= uniform.count) { return; }

    // update times
    var particle = particles[index];
    particle.collisionTime += uniform.dt;

    // if particle gets too far, reset it to its original position / velocity
    var distance = length(particle.position);
    if (distance > 300.0) {
        var temp = particle.position;
        var wrapDistance = distance - 300.0;
        particle.collisionTime = 100.0;
        particle.positionOld = vec3f(0.0, 0.0, 0.0) + wrapDistance * particle.originalVelocity;
        particle.position = particle.originalVelocity;
    }

    // Verlet integration for a simple physics simulation
    var delta = (particle.position - particle.positionOld);
    var next = particle.position + delta;

    // handle collisions with spheres
    for (var i = 0u; i < uniform.sphereCount; i++) {
        var center = spheres[i].center;
        var radius = spheres[i].radius;

        // if the particle is inside the sphere, move it to the surface
        if (length(next - center) < radius) {
            next = center + normalize(next - center) * radius;
            particle.collisionTime = 0.0;
        }
    }

    // write out the changes
    particle.positionOld = particle.position;
    particle.position = next;
    particles[index] = particle;
}
