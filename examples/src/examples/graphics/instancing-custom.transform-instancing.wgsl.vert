
// instancing attributes
attribute aInstPosition: vec3f;
attribute aInstScale: f32;

// uniforms
uniform uTime: f32;
uniform uCenter: vec3f;

// all instancing chunk needs to do is to implement getModelMatrix function, which returns a world matrix for the instance
fn getModelMatrix() -> mat4x4f {

    // we have world position in aInstPosition, but modify it based on distance from uCenter for some displacement effect
    var direction: vec3f = aInstPosition - uniform.uCenter;
    var distanceFromCenter: f32 = length(direction);
    var displacementIntensity: f32 = exp(-distanceFromCenter * 0.2); //* (1.9 + abs(sin(uniform.uTime * 1.5)));
    var worldPos: vec3f = aInstPosition - direction * displacementIntensity;

    // create matrix based on the modified poition, and scale
    return mat4x4f(
        vec4f(aInstScale, 0.0, 0.0, 0.0),
        vec4f(0.0, aInstScale, 0.0, 0.0),
        vec4f(0.0, 0.0, aInstScale, 0.0),
        vec4f(worldPos, 1.0)
    );
}

