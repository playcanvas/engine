// Vertex shader running one step of the flock simulation using transform feedback in
// TRANSFORM_FEEDBACK_SEPARATE mode, which captures each output varying into its own buffer.
//
// The three inputs and three outputs do not line up one to one - each buffer has its own role:
//
//   aPosition / out_position  - simulation state, read and written every step
//   aVelocity / out_velocity  - simulation state, read and written every step
//   aConstants                - per-agent constants, read only, never written
//   out_instance              - render data, written only, consumed by the instanced draw
//
// Under interleaved capture everything would land in a single buffer, so the constants would have
// to be copied through every step and the render pass would have to stride over simulation state
// it has no use for.

attribute vec4 aPosition;    // xyz = world position
attribute vec4 aVelocity;    // xyz = velocity
attribute vec4 aConstants;   // x = seed, y = maximum speed, z = wander strength

varying vec4 out_position;
varying vec4 out_velocity;
varying vec4 out_instance;   // xyz = world position, w = heading (yaw)

uniform float uDeltaTime;
uniform float uTime;
uniform float uAreaSize;

void main(void) {

    vec3 pos = aPosition.xyz;
    vec3 vel = aVelocity.xyz;

    float seed = aConstants.x;
    float maxSpeed = aConstants.y;
    float wanderStrength = aConstants.z;

    // ease each agent towards its own preferred radius, so the flock forms nested bands
    float radius = length(pos.xz);
    float preferred = uAreaSize * (0.35 + seed * 0.55);
    vec3 radial = vec3(pos.x, 0.0, pos.z) / max(radius, 0.001);
    vec3 toBand = -radial * (radius - preferred) * 1.6;

    // swirl around the vertical axis
    vec3 swirl = vec3(-pos.z, 0.0, pos.x) * 0.5;

    // vertical bobbing, phase shifted per agent and pulled back towards the plane
    float bob = sin(uTime * 0.6 + seed * 6.28 + radius * 0.25) * 5.0 - pos.y * 1.5;

    vec3 accel = toBand + swirl + vec3(0.0, bob, 0.0);

    // per-agent wander, so the bands do not collapse into perfect rings
    accel += vec3(
        sin(uTime * 1.3 + seed * 12.9),
        sin(uTime * 0.9 + seed * 7.3) * 0.4,
        cos(uTime * 1.1 + seed * 4.7)
    ) * wanderStrength;

    vel += accel * uDeltaTime;

    // drag, so agents settle below their maximum rather than all pinning to it
    vel *= max(0.0, 1.0 - 1.5 * uDeltaTime);

    float speed = length(vel);
    if (speed > maxSpeed) {
        vel *= maxSpeed / speed;
    }

    pos += vel * uDeltaTime;

    // simulation state, fed back in on the next step
    out_position = vec4(pos, 0.0);
    out_velocity = vec4(vel, 0.0);

    // the render pass only needs a position and a heading to orient the cone, so that is all that
    // goes into the instancing buffer
    out_instance = vec4(pos, atan(vel.x, vel.z));
}
