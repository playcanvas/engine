attribute aPosition: vec3f;
attribute aUv0: vec2f;

// xyz: the ground position of the statue, w: its scale
attribute aInstance: vec4f;

uniform matrix_viewProjection: mat4x4f;
uniform matrix_view: mat4x4f;
uniform view_position: vec3f;

// the center of the statue's bounding sphere, relative to the statue's origin
uniform uCenterOffset: vec3f;

// the radius of the statue's bounding sphere
uniform uRadius: f32;

// x: the number of azimuth angles, y: the number of elevation angles, z: the elevation step in radians
uniform uFrameInfo: vec3f;

varying vUv0: vec2f;
varying vLayer: f32;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let scale = aInstance.w;
    let center = aInstance.xyz + uniform.uCenterOffset * scale;

    // pick the baked view closest to the direction from the statue to the camera
    let toCamera = normalize(uniform.view_position - center);
    let azimuth = atan2(toCamera.x, toCamera.z);
    let elevation = asin(clamp(toCamera.y, -1.0, 1.0));

    let azimuthCount = uniform.uFrameInfo.x;
    let azimuthStep = floor(azimuth / (6.28318530718 / azimuthCount) + 0.5);
    let azimuthIndex = azimuthStep - azimuthCount * floor(azimuthStep / azimuthCount);
    let elevationIndex = clamp(floor(elevation / uniform.uFrameInfo.z + 0.5), 0.0, uniform.uFrameInfo.y - 1.0);
    output.vLayer = elevationIndex * azimuthCount + azimuthIndex;

    // a quad facing the camera, covering the bounding sphere
    let view = uniform.matrix_view;
    let right = vec3f(view[0][0], view[1][0], view[2][0]);
    let up = vec3f(view[0][1], view[1][1], view[2][1]);
    let size = 2.0 * uniform.uRadius * scale;
    let position = center + (right * aPosition.x + up * aPosition.y) * size;

    output.vUv0 = aUv0;
    output.position = uniform.matrix_viewProjection * vec4f(position, 1.0);

    return output;
}
