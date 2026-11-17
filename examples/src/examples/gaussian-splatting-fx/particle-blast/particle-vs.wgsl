// Renders each particle of the SceneParticlesEffect as a camera facing capsule, one instance of the
// quad each, stretched along its motion like a camera with a short shutter would.

#include "sceneParticleCS"

var<storage, read> sceneParticles: array<SceneParticle>;

uniform sceneParticleViewProjection: mat4x4f;
uniform sceneParticleCameraPosition: vec3f;

// the ring buffer slot of the first particle drawn, and the number of slots
uniform sceneParticleFirst: u32;
uniform sceneParticleCapacity: u32;

// how long the particles are stretched along their motion, in seconds of it
uniform sceneParticleStreak: f32;

// the glow of the fresh particles, and of the impacts
uniform sceneParticleGlow: f32;

// how much the particles take the colors of fire instead of the colors of the scene, how hot they
// start, 1 being white hot, and how fast they cool down, per second
uniform sceneParticleFire: f32;
uniform sceneParticleTemperature: f32;
uniform sceneParticleCooling: f32;

attribute aPosition: vec2f;

varying vColor: vec3f;
varying vUv: vec2f;
varying vStretch: f32;

// The color of something glowing with heat, from 1 for white hot down to 0 for cold: through
// yellow, orange and red to a dark crust, and much brighter the hotter it is.
fn sceneParticleFireColor(heat: f32) -> vec3f {
    let h = clamp(heat, 0.0, 1.0);
    let hue = vec3f(smoothstep(0.0, 0.35, h), smoothstep(0.25, 0.8, h), smoothstep(0.65, 1.0, h));
    let crust = vec3f(0.035, 0.025, 0.02);
    return mix(crust, hue * (0.15 + 2.5 * h * h), smoothstep(0.0, 0.12, h));
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let particle = sceneParticles[(uniform.sceneParticleFirst + pcInstanceIndex) % uniform.sceneParticleCapacity];

    // the dead and the hidden particles are moved outside of the clip space
    if (particle.life <= 0.0 || (particle.flags & SCENE_PARTICLE_HIDDEN) != 0u) {
        output.position = vec4f(2.0, 2.0, 2.0, 1.0);
        return output;
    }

    // the particles pop in, and shrink away at the end of their life
    let t = particle.age / particle.life;
    let colorBRadius = unpack2x16float(particle.colorBRadius);
    var radius = colorBRadius.y * smoothstep(0.0, 0.04, particle.age) * (1.0 - smoothstep(0.7, 1.0, t));

    // and get out of the way of the camera, instead of filling the screen
    let cameraOffset = uniform.sceneParticleCameraPosition - particle.position;
    let cameraDistance = length(cameraOffset);
    radius *= smoothstep(0.15, 0.5, cameraDistance);

    // the motion across the view
    let toCamera = cameraOffset / cameraDistance;
    let velocity = particle.velocity;
    let across = velocity - toCamera * dot(velocity, toCamera);
    let speed = length(across);
    let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(toCamera.y) > 0.99);
    let axis = select(normalize(cross(up, toCamera)), across / speed, speed > 0.0001);
    let side = cross(toCamera, axis);

    let halfLength = radius + min(speed * uniform.sceneParticleStreak, 0.1);
    let corner = input.aPosition;
    let position = particle.position + axis * (corner.x * halfLength) + side * (corner.y * radius);
    output.position = uniform.sceneParticleViewProjection * vec4f(position, 1.0);

    // the capsule in units of the radius
    output.vStretch = halfLength / max(radius, 0.00001) - 1.0;
    output.vUv = vec2f(corner.x * (output.vStretch + 1.0), corner.y);

    // The particles leave the surface glowing in its color, with a brief ember tint at first, and
    // cool down into the color of the surface. An impact makes them flash.
    let glow = uniform.sceneParticleGlow;
    let surface = vec3f(unpack2x16float(particle.colorRG), colorBRadius.x);
    let heat = exp(-particle.age * 2.0);
    let ember = vec3f(1.0, 0.45, 0.15);
    let surfaceColor = surface * (1.0 + glow * heat * 6.0) + ember * (glow * pow(heat, 6.0) * 2.0);

    // or they leave it glowing with heat, and cool down at rates which differ a little between them
    let cooling = uniform.sceneParticleCooling * mix(0.5, 1.5, sceneParticleSeed(particle));
    let fireHeat = uniform.sceneParticleTemperature * exp(-particle.age * cooling);
    let fireColor = sceneParticleFireColor(fireHeat) * (0.5 + glow);

    let fire = uniform.sceneParticleFire;
    let color = mix(surface, fireColor, fire);
    output.vColor = mix(surfaceColor, fireColor, fire) + (color * 0.5 + ember) * (glow * particle.flash * 5.0);

    return output;
}
