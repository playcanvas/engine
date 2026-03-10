// Texture (unsigned-integer, fetch-only)
var sourceTexture: texture_2d<u32>;

// Uniforms (auto-buffered, accessed as uniform.<name>)
uniform mousePosition: vec2f;
uniform brushRadius: f32;

// Interpolated varying (from vertex shader)
varying uv0: vec2f;

// Color constants
const whiteColor: vec3f = vec3f(1.0);
const skyBlueColor: vec3f = vec3f(0.2, 0.2, 0.2);
const yellowSandColor: vec3f = vec3f(0.73, 0.58, 0.26);
const orangeSandColor: vec3f = vec3f(0.87, 0.43, 0.22);
const graySandColor: vec3f = vec3f(0.13, 0.16, 0.17);
const grayWallColor: vec3f = vec3f(0.5, 0.5, 0.5);
const waterBlueColor: vec3f = vec3f(0.2, 0.3, 0.8);

// Particle element constants
const AIR: u32 = 0u;
const SAND: u32 = 1u;
const ORANGESAND: u32 = 2u;
const GRAYSAND: u32 = 3u;
const WALL: u32 = 4u;

// Circle distance function
fn circle(p: vec2f, r: f32) -> f32 {
    return length(p) - r;
}

const circleOutline: f32 = 0.0025;

// Helper: check bounds in integer texel space
fn isInBounds(c: vec2i, size: vec2i) -> bool {
    return (c.x > 0 && c.x < size.x - 1) &&
           (c.y > 0 && c.y < size.y - 1);
}

// Particle representation
struct Particle {
    element: u32,
    movedThisFrame: bool,
    shade: u32,
    waterMass: u32 // unused here
};

// Pseudo-random generator
fn rand(pos: vec2f, val: f32) -> f32 {
    return fract(pos.x * pos.y * val * 1000.0);
}

// Pack a Particle into a single u32
fn pack(p: Particle) -> u32 {
    var packed: u32 = 0u;
    packed |= (p.element & 0x7u);
    packed |= u32(p.movedThisFrame) << 3;
    packed |= ((p.shade & 0xFu) << 4);
    return packed;
}

// Unpack a u32 into a Particle
fn unpack(packed: u32) -> Particle {
    var pt: Particle;
    pt.element = packed & 0x7u;
    pt.movedThisFrame = ((packed >> 3) & 0x1u) != 0u;
    pt.shade = (packed >> 4) & 0xFu;
    pt.waterMass = 0u;
    return pt;
}

// Fetch and decode a particle from the texture
fn getParticle(coord: vec2i) -> Particle {
    let texel: vec4<u32> = textureLoad(sourceTexture, coord, 0);
    return unpack(texel.x);
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // Determine integer texture size & sample coordinate
    let dims: vec2u = textureDimensions(sourceTexture);
    let size: vec2i = vec2i(dims);
    let coord: vec2i = vec2i(input.uv0 * vec2f(size));

    let particle = getParticle(coord);

    var gameColor: vec3f = skyBlueColor;
    if (particle.element == SAND) {
        gameColor = mix(yellowSandColor, whiteColor, (f32(particle.shade) / 15.0) * 0.5);
    } else if (particle.element == WALL) {
        gameColor = grayWallColor;
    } else if (particle.element == ORANGESAND) {
        gameColor = mix(orangeSandColor, whiteColor, (f32(particle.shade) / 15.0) * 0.5);
    } else if (particle.element == GRAYSAND) {
        gameColor = mix(graySandColor, whiteColor, (f32(particle.shade) / 15.0) * 0.5);
    }

    // Render a brush circle
    let d: f32 = length(input.uv0 - uniform.mousePosition);
    let wd: f32 = fwidth(d);
    let circleVal: f32 = smoothstep(uniform.brushRadius + wd, uniform.brushRadius, d);
    let circleInner: f32 = smoothstep(uniform.brushRadius - circleOutline + wd, uniform.brushRadius - circleOutline, d);
    let brush: f32 = max(circleVal - circleInner, 0.0) * 0.5;

    let outColor: vec3f = mix(gameColor, vec3f(1.0), brush);

    output.color = vec4f(outColor, 1.0);
    return output;
}

