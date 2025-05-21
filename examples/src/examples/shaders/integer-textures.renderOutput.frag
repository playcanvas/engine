precision highp usampler2D;
uniform usampler2D sourceTexture;
uniform vec2 mousePosition;
uniform float brushRadius;
varying vec2 uv0;

vec3 whiteColor = vec3(1.0);
vec3 skyBlueColor = vec3(0.2, 0.2, 0.2);
vec3 yellowSandColor = vec3(0.73, 0.58, 0.26);
vec3 orangeSandColor = vec3(0.87, 0.43, 0.22);
vec3 graySandColor = vec3(0.13, 0.16, 0.17);
vec3 grayWallColor = vec3(0.5, 0.5, 0.5);
vec3 waterBlueColor = vec3(0.2, 0.3, 0.8);

float circle( vec2 p, float r ) {
    return length(p) - r;
}

const float circleOutline = 0.0025;

const uint AIR = 0u;
const uint SAND = 1u;
const uint ORANGESAND = 2u;
const uint GRAYSAND = 3u;
const uint WALL = 4u;

bool isInBounds(ivec2 c, ivec2 size) {
    return c.x > 0 && c.x < size.x - 1 && c.y > 0 && c.y < size.y - 1;
}

struct Particle {
    uint element;        // 3 bits
    bool movedThisFrame; // 1 bit
    uint shade;          // 4 bits
    uint waterMass;      // 8 bits
};

float rand(vec2 pos, float val) {
    return fract(pos.x * pos.y * val * 1000.0);
}

uint pack(Particle particle) {
    uint packed = 0u;
    packed |= (particle.element & 0x7u);      // Store element in the lowest 3 bits
    packed |= ((particle.movedThisFrame ? 1u : 0u) << 3); // Store movedThisFrame in the next bit
    packed |= (particle.shade << 4);          // Store shade in the next 4 bits

    return packed; // Second component is reserved/unused
}

Particle unpack(uint packed) {
    Particle particle;
    particle.element = packed & 0x7u;                         // Extract lowest 3 bits
    particle.movedThisFrame = ((packed >> 3) & 0x1u) != 0u;   // Extract the next bit
    particle.shade = (packed >> 4) & 0xFu;                    // Extract the next 4 bits            
    return particle;
}

Particle getParticle(ivec2 c) {
    uint val = texelFetch(sourceTexture, c, 0).r;
    return unpack(val);
}

void main() {
    ivec2 size = textureSize(sourceTexture, 0);
    ivec2 coord = ivec2(uv0 * vec2(size));
    Particle particle = getParticle(coord);

    vec3 gameColor = skyBlueColor;
    if (particle.element == SAND) {
        gameColor = mix(yellowSandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);
    } else if (particle.element == WALL) {
        gameColor = grayWallColor;
    } else if (particle.element == ORANGESAND) {
        gameColor = mix(orangeSandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);
    } else if (particle.element == GRAYSAND) {
        gameColor = mix(graySandColor, whiteColor, (float(particle.shade) / 15.0) * 0.5);
    }

    // Render a brush circle
    float d = length(uv0 - mousePosition);
    float wd = fwidth(d);
    float circle = smoothstep(brushRadius + wd, brushRadius, d);
    float circleInner = smoothstep(brushRadius - circleOutline + wd, brushRadius - circleOutline, d);
    float brush = max(circle - circleInner, 0.0) * 0.5;

    vec3 outColor = mix(gameColor, vec3(1.0), brush);

    gl_FragColor = vec4(outColor, 1.0);
}
