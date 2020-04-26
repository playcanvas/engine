
uniform vec3 view_position;

uniform vec3 light_globalAmbient;

float square(float x) {
    return x*x;
}

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec3 saturate(vec3 x) {
    return clamp(x, vec3(0.0), vec3(1.0));
}

float getLuminance(vec3 color) {
    // https://en.wikipedia.org/wiki/Relative_luminance
    return saturate(dot(color, vec3(0.2126, 0.7152, 0.0722)));
}

