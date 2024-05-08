
// vertex shader used to move particles during transform-feedback simulation step

// input and output is vec4, containing position in .xyz and lifetime in .w
attribute vec4 vertex_position;
varying vec4 out_vertex_position;

// parameters controlling simulation
uniform float deltaTime;
uniform float areaSize;

// texture storing random direction vectors
uniform sampler2D directionSampler;

// function returning random number based on vec2 seed parameter
float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main(void) {

    // texture contains direction of particle movement - read it based on particle's position
    vec2 texCoord = vertex_position.xz / areaSize + 0.5;
    vec3 dir = texture2D(directionSampler, texCoord).xyz;
    dir = dir * 2.0 - 1.0;

    // move particle along direction with some speed
    float speed = 20.0 * deltaTime;
    vec3 pos = vertex_position.xyz + dir * speed;

    // age the particle
    float liveTime = vertex_position.w;
    liveTime -= deltaTime;

    // if particle is too old, regenerate it
    if (liveTime <= 0.0) {

        // random life time
        liveTime = rand(pos.xy) * 2.0;

        // random position
        pos.x = rand(pos.xz) * areaSize - 0.5 * areaSize;
        pos.y = rand(pos.xy) * 4.0;
        pos.z = rand(pos.yz) * areaSize - 0.5 * areaSize;
    }

    // write out updated particle
    out_vertex_position = vec4(pos, liveTime);
}