export default /* glsl */`

#ifndef LINEARIZE_DEPTH
#define LINEARIZE_DEPTH

float linearizeDepthWithParams(float z, vec4 cameraParams) {
    if (cameraParams.w == 0.0)
        return (cameraParams.z * cameraParams.y) / (cameraParams.y + z * (cameraParams.z - cameraParams.y));
    else
        return cameraParams.z + z * (cameraParams.y - cameraParams.z);
}

#ifndef CAMERAPLANES
    #define CAMERAPLANES
    uniform vec4 camera_params; // x: 1 / camera_far,      y: camera_far,     z: camera_near,        w: is_ortho
#endif

float linearizeDepth(float z) {
    return linearizeDepthWithParams(z, camera_params);
}
#endif
`;
