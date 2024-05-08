uniform float uTime;
varying float height;

void main(void)
{
    // evaluate center of the splat in object space
    vec3 centerLocal = evalCenter();

    // modify it
    float heightIntensity = centerLocal.y * 0.2;
    centerLocal.x += sin(uTime * 5.0 + centerLocal.y) * 0.3 * heightIntensity;

    // output y-coordinate
    height = centerLocal.y;

    // evaluate the rest of the splat using world space center
    vec4 centerWorld = matrix_model * vec4(centerLocal, 1.0);
    gl_Position = evalSplat(centerWorld);
}
