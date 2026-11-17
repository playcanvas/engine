// The particle of the SceneParticlesEffect, shared by its compute shaders and its vertex shader.

// A particle, 48 bytes. The color is stored as half floats, which is plenty for the colors sampled
// from the scene, and keeps the particle three vec4s in size. A zeroed particle is dead.
struct SceneParticle {
    position: vec3f,
    age: f32,
    velocity: vec3f,

    // the lifetime of the particle in seconds, zero for a dead particle
    life: f32,

    // the red and green of the color sampled from the scene
    colorRG: u32,

    // the blue of the color sampled from the scene, and the radius of the particle
    colorBRadius: u32,

    // the flash of light of the last impact, fading out
    flash: f32,

    // the low 16 bits: a random number constant for the life of the particle, see
    // sceneParticleSeed. SCENE_PARTICLE_HIDDEN: the particle is hidden behind the scene this frame.
    flags: u32
}

const SCENE_PARTICLE_HIDDEN = 0x10000u;

// the random number of a particle, in the range 0..1
fn sceneParticleSeed(particle: SceneParticle) -> f32 {
    return f32(particle.flags & 0xffffu) / 65535.0;
}
