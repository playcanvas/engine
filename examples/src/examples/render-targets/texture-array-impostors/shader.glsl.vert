attribute vec3 aPosition;
attribute vec2 aUv0;

// xyz: the ground position of the statue, w: its scale
attribute vec4 aInstance;

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_view;
uniform vec3 view_position;

// the center of the statue's bounding sphere, relative to the statue's origin
uniform vec3 uCenterOffset;

// the radius of the statue's bounding sphere
uniform float uRadius;

// x: the number of azimuth angles, y: the number of elevation angles, z: the elevation step in radians
uniform vec3 uFrameInfo;

varying vec2 vUv0;
varying float vLayer;

void main(void)
{
    float scale = aInstance.w;
    vec3 center = aInstance.xyz + uCenterOffset * scale;

    // pick the baked view closest to the direction from the statue to the camera
    vec3 toCamera = normalize(view_position - center);
    float azimuth = atan(toCamera.x, toCamera.z);
    float elevation = asin(clamp(toCamera.y, -1.0, 1.0));

    float azimuthCount = uFrameInfo.x;
    float azimuthIndex = mod(floor(azimuth / (6.28318530718 / azimuthCount) + 0.5), azimuthCount);
    float elevationIndex = clamp(floor(elevation / uFrameInfo.z + 0.5), 0.0, uFrameInfo.y - 1.0);
    vLayer = elevationIndex * azimuthCount + azimuthIndex;

    // a quad facing the camera, covering the bounding sphere
    vec3 right = vec3(matrix_view[0][0], matrix_view[1][0], matrix_view[2][0]);
    vec3 up = vec3(matrix_view[0][1], matrix_view[1][1], matrix_view[2][1]);
    float size = 2.0 * uRadius * scale;
    vec3 position = center + (right * aPosition.x + up * aPosition.y) * size;

    vUv0 = aUv0;
    gl_Position = matrix_viewProjection * vec4(position, 1.0);
}
