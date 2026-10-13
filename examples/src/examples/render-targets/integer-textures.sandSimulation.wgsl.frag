// Texture (unsigned‐integer, fetch‐only)
var sourceTexture: texture_2d<u32>;

// Uniforms (auto‐buffered, accessed as uniform.<name>)
uniform mousePosition: vec2f;
uniform mouseButton: u32;
uniform passNum: u32;
uniform brush: u32;
uniform randomVal: f32;
uniform brushRadius: f32;

// Interpolated varying (from vertex shader)
varying uv0: vec2f;

// Particle element constants
const AIR: u32      = 0u;
const SAND: u32     = 1u;
const ORANGESAND: u32 = 2u;
const GRAYSAND: u32 = 3u;
const WALL: u32     = 4u;

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

// Pseudo‐random generator
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
    pt.element        = packed & 0x7u;
    pt.movedThisFrame = ((packed >> 3) & 0x1u) != 0u;
    pt.shade          = (packed >> 4) & 0xFu;
    pt.waterMass      = 0u;
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
    let dims: vec2u    = textureDimensions(sourceTexture);
    let size: vec2i    = vec2i(dims);
    let coord: vec2i   = vec2i(input.uv0 * vec2f(size));

    // Out‐of‐bounds → write “wall”
    if (!isInBounds(coord, size)) {
        output.color = WALL;
        return output;
    }

    // Mouse interaction
    let d: f32  = distance(uniform.mousePosition, input.uv0);
    let dir: i32 = i32(uniform.passNum % 3u) - 1;

    let current = getParticle(coord);
    var nextState = current;

    if (uniform.mouseButton == 1u && d < uniform.brushRadius) {
        nextState.element        = uniform.brush;
        nextState.movedThisFrame = true;
        nextState.shade          = u32(rand(input.uv0, uniform.randomVal * f32(uniform.passNum)) * 15.0);
    } else if (uniform.mouseButton == 2u && d < uniform.brushRadius) {
        nextState.element        = AIR;
        nextState.movedThisFrame = false;
        nextState.shade          = u32(rand(input.uv0, uniform.randomVal * f32(uniform.passNum)) * 15.0);
    }

    // Gravity / flow logic
    let base: Particle = Particle(
        current.element,
        false,
        current.shade,
        0u
    );

    if (base.element == AIR) {
        let above = getParticle(coord + vec2i(dir, -1));
        if (above.element != AIR && above.element != WALL) {
            nextState = above;
            nextState.movedThisFrame = true;
        }
    } else if (base.element != WALL) {
        let below = getParticle(coord + vec2i(-dir, 1));
        if (below.element == AIR && !below.movedThisFrame) {
            nextState = below;
            nextState.movedThisFrame = false;
        }
    }

    // Write packed result back into the red channel
    let packedResult: u32 = pack(nextState);
    output.color = packedResult;
    return output;
}
