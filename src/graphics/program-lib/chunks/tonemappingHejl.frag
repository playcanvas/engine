uniform float exposure;

vec3 toneMap(vec3 color) {
    color *= exposure;
    vec3 x = max(vec3(0.0), color - vec3(0.004));
    color = (x*(6.2*x + 0.5)) / (x*(6.2*x + 1.7) + 0.06);
    return gammaCorrectInput(color);
}

