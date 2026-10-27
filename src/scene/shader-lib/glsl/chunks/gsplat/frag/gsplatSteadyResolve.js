export default /* glsl */`
uniform highp sampler2D steadyRaw;

vec4 steadySpatialAt(ivec2 p) {
    vec4 color = texelFetch(steadyRaw, p, 0);
    float mass = 1.0;
    for (int n = 0; n < 4; n++) {
        ivec2 source = p - STEADY_NEIGHBORS[n];
        if (all(greaterThanEqual(source, ivec2(0))) && all(lessThan(source, ivec2(steadySize)))) {
            float weight = steadyWeightsAt(source)[n];
            color += texelFetch(steadyRaw, source, 0) * weight;
            mass += weight;
        }
    }
    return color / mass;
}

#ifdef STEADY_TEMPORAL
uniform highp sampler2D steadyPrevious;
uniform int steadyCameraStill;
uniform float steadyRetention;
uniform vec3 steadyBackground;
uniform mat4 steadyInverseProjection;
uniform mat4 steadyInverseView;
uniform mat4 steadyPreviousViewProjection;

vec3 steadyYCoCg(vec3 c) {
    return vec3(dot(c, vec3(0.25, 0.5, 0.25)), (c.r - c.b) * 0.5, dot(c, vec3(-0.25, 0.5, -0.25)));
}

vec3 steadyRadiance(vec4 color) {
    return color.rgb + (1.0 - color.a) * steadyBackground;
}

vec4 steadyCubic(float t) {
    float t2 = t * t;
    float t3 = t2 * t;
    return vec4(-0.5 * t + t2 - 0.5 * t3, 1.0 - 2.5 * t2 + 1.5 * t3,
                0.5 * t + 2.0 * t2 - 1.5 * t3, -0.5 * t2 + 0.5 * t3);
}

vec4 steadyHistoryAt(vec2 pixel) {
    ivec2 base = ivec2(floor(pixel - 0.5));
    vec2 fraction = fract(pixel - 0.5);
    vec4 wx = steadyCubic(fraction.x);
    vec4 wy = steadyCubic(fraction.y);
    vec4 color = vec4(0.0);
    for (int y = 0; y < 4; y++) {
        for (int x = 0; x < 4; x++) {
            ivec2 q = clamp(base + ivec2(x - 1, y - 1), ivec2(0), ivec2(steadySize) - 1);
            color += wx[x] * wy[y] * texelFetch(steadyPrevious, q, 0);
        }
    }
    return color;
}

vec4 steadyTemporalAt(ivec2 p, vec4 current) {
    if (steadyValid == 0 || steadyRetention <= 0.0) return current;
    vec2 pixel = vec2(p) + 0.5;
    vec2 previousPixel = pixel;
    // Identical rays reuse their texel, including empty samples and image borders.
    vec4 historical = texelFetch(steadyPrevious, p, 0);
    if (steadyCameraStill == 0) {
        uvec4 sampleData = texelFetch(steadySamples, p, 0);
        vec2 ndc = pixel / steadySize * 2.0 - 1.0;
        vec4 unprojected = steadyInverseProjection * vec4(ndc, 1.0, 1.0);
        vec3 ray = unprojected.xyz / -unprojected.z;
        float depth = uintBitsToFloat(sampleData.y);
        vec4 world = steadyInverseView * (sampleData.x != 0u ? vec4(ray * depth, 1.0) : vec4(ray, 0.0));
        vec4 previousClip = steadyPreviousViewProjection * world;
        previousPixel = (previousClip.xy / max(previousClip.w, 1e-20) * 0.5 + 0.5) * steadySize;
        if (previousClip.w <= 0.0 || any(lessThan(previousPixel, vec2(2.0))) || any(greaterThanEqual(previousPixel, steadySize - 2.0))) {
            return current;
        }
        historical = steadyHistoryAt(previousPixel);
    }
    vec3 mean = vec3(0.0);
    vec3 second = vec3(0.0);
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            ivec2 q = clamp(p + ivec2(x, y), ivec2(0), ivec2(steadySize) - 1);
            vec4 raw = texelFetch(steadyRaw, q, 0);
            vec3 value = steadyYCoCg(steadyRadiance(raw));
            mean += value;
            second += value * value;
        }
    }
    mean /= 9.0;
    vec3 sigma = sqrt(max(second / 9.0 - mean * mean, vec3(0.0)));
    float gamma = mix(4.0, 1.0, min(length(pixel - previousPixel) / 4.0, 1.0));
    vec3 extent = max(sigma * gamma, vec3(0.01, 0.005, 0.005));
    vec3 delta = abs(steadyYCoCg(steadyRadiance(historical)) - mean) / extent;
    float rejection = max(delta.x, max(delta.y, delta.z));
    return mix(current, historical, steadyRetention / max(1.0, rejection));
}
#endif

#ifdef STEADY_CONVERGENCE
uniform highp sampler2D steadyRest;
uniform int steadyRestFrames;
#endif

void main(void) {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 spatial = steadySpatialAt(p);
    vec4 color = spatial;
    #ifdef STEADY_TEMPORAL
        color = steadyTemporalAt(p, color);
    #endif
    #ifdef STEADY_CONVERGENCE
        vec4 average = vec4(0.0);
        if (steadyRestFrames > 0) {
            vec4 sampleData = steadyRestFrames <= 8 ? spatial : texelFetch(steadyRaw, p, 0);
            average = sampleData;
            if (steadyRestFrames > 1) {
                average = texelFetch(steadyRest, p, 0);
                average += (sampleData - average) / float(steadyRestFrames);
            }
            color = mix(color, average, float(steadyRestFrames) / (float(steadyRestFrames) + 8.0));
        }
        pcFragColor1 = average;
    #endif
    float alpha = clamp(color.a, 0.0, 1.0);
    vec3 rgb = color.a > 0.0 ? color.rgb * alpha / max(color.a, 1e-8) : vec3(0.0);
    pcFragColor0 = vec4(rgb, alpha);
}
`;
