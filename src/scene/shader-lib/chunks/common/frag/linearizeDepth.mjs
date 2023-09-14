export default /* glsl */`

#ifndef LINEARIZE_DEPTH
#define LINEARIZE_DEPTH

float linearizeDepth(float z, vec4 cameraParams) {
    if (cameraParams.w == 0.0)
        return (cameraParams.z * cameraParams.y) / (cameraParams.y + z * (cameraParams.z - cameraParams.y));
    else
        return cameraParams.z + z * (cameraParams.y - cameraParams.z);
}

#ifndef CAMERAPLANES
#define CAMERAPLANES
uniform vec4 camera_params; // x: 1 / camera_far,      y: camera_far,     z: camera_near,        w: is_ortho
#endif

#ifdef GL2
float linearizeDepth(float z) {
    return linearizeDepth(z, camera_params);
}
#else
#ifndef UNPACKFLOAT
#define UNPACKFLOAT
float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgbaDepth, bitShift);
}
#endif
#endif
#endif
`;
