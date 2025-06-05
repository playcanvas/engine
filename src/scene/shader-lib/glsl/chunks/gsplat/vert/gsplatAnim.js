export default /* glsl */`

uniform float appTime;

void animatePRS(inout vec3 position, inout mat3 rotation, inout vec3 scale) {

}

vec4 animateColor(vec3 p, mat3 r, vec3 s, vec4 color) {
    return vec4(
        color.x * 3.0 * (sin(appTime + p.x * 2.0) * 0.5 + 0.5),
        color.y * 2.0 * (sin(appTime * 4.0 + p.y * 2.0) * 0.5 + 0.5),
        color.z * 1.0 * (sin(appTime * 3.0 + p.z * 2.0) * 0.5 + 0.5),
        color.w
    );
}

`;
