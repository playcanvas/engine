
// instancing attributes
attribute vec3 aInstPosition;
attribute float aInstScale;

// uniforms
uniform float uTime;
uniform vec3 uCenter;

// all instancing chunk needs to do is to implement getModelMatrix function, which returns a world matrix for the instance
mat4 getModelMatrix() {

    // we have world position in aInstPosition, but modify it based on distance from uCenter for some displacement effect
    vec3 direction = aInstPosition - uCenter;
    float distanceFromCenter = length(direction);
    float displacementIntensity = exp(-distanceFromCenter * 0.2) ; //* (1.9 + abs(sin(uTime * 1.5)));
    vec3 worldPos = aInstPosition - direction * displacementIntensity;

    // create matrix based on the modified poition, and scale
    return mat4(
        vec4(aInstScale, 0.0, 0.0, 0.0),
        vec4(0.0, aInstScale, 0.0, 0.0),
        vec4(0.0, 0.0, aInstScale, 0.0),
        vec4(worldPos, 1.0)
    );
}

