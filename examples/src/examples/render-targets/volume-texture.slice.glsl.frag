// the normalized height of the depth slice rendered to
uniform float uHeight;
uniform float uTime;

varying vec2 uv0;

float hash(float n) {
    return fract(sin(n) * 43758.5453);
}

// a fully saturated color of the specified hue (0..1)
vec3 hueToColor(float hue) {
    return clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

void main(void)
{
    // the position in the volume, x and z across the slice, y is its height
    vec3 p = vec3(uv0.x, uHeight, uv0.y);

    // sum colorful blobs of fog drifting around, weighting their colors by their density
    float density = 0.0;
    vec3 color = vec3(0.0);
    for (int i = 0; i < 12; i++) {
        float fi = float(i);
        vec3 center = vec3(hash(fi * 3.1 + 0.5), hash(fi * 5.7 + 1.3) * 0.6, hash(fi * 7.3 + 2.1));
        center.xz += 0.15 * vec2(sin(uTime * 0.3 + fi * 1.7), cos(uTime * 0.23 + fi * 2.3));
        float radius = 0.12 + hash(fi * 11.1 + 3.7) * 0.15;
        vec3 d = p - center;
        d.y *= 0.5;
        float weight = exp(-dot(d, d) / (radius * radius));
        density += weight;
        color += weight * hueToColor(fi / 12.0);
    }

    // break the blobs up with some wavy detail, and fade out the fog towards the top
    float detail = 0.6 + 0.4 * sin(p.x * 37.0 + sin(p.z * 23.0) + uTime) * sin(p.z * 31.0 + p.y * 11.0);
    float fade = (1.0 - p.y) * (1.0 - p.y);

    gl_FragColor = vec4(density > 0.0 ? color / density : vec3(0.0), clamp(density * detail * fade, 0.0, 1.0));
}
