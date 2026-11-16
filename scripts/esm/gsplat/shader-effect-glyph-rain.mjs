import {
    ADDRESS_CLAMP_TO_EDGE,
    Color,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    PIXELFORMAT_RGBA8,
    TYPE_UINT32,
    Texture
} from 'playcanvas';

import { GSplatShaderEffect } from './gsplat-shader-effect.mjs';

// The varying passing the glyph from the vertex to the fragment stage. It packs the glyph index
// (bits 0-5), a glyph flag (bit 6) and the glyph opacity (bits 8-15).
const VARYING = 'glyphInfo';

/**
 * Fills a reusable uniform array.
 *
 * @param {number[]} array - The array to fill.
 * @param {...number} values - The values.
 * @returns {number[]} The array.
 */
const set = (array, ...values) => {
    for (let i = 0; i < values.length; i++) array[i] = values[i];
    return array;
};

const shaderGLSL = /* glsl */`
uniform vec3 uPhases;       // x: rain (rows), y: fall (cycles), z: glyph swaps
uniform vec4 uGlyph;        // x: fraction of splats which are glyphs, y: glyph size, z: snap to grid, w: glyph count
uniform vec4 uGlyphLook;    // x: brightness, y: resting glow, z: scene shading, w: opacity
uniform vec3 uRain;         // x: trail length (rows), y: drop spacing (rows), z: head intensity
uniform float uFallDistance;
uniform vec4 uOthers;       // x: density, y: max size, z: opacity, w: brightness
uniform vec2 uOthersLook;   // x: tint, y: rain response
uniform vec3 uGlyphColor;
uniform vec3 uHeadColor;
uniform vec4 uTurb;         // x: amount, y: frequency, z: phase, w: amount for the other splats

const uint KIND_HIDDEN = 0u;
const uint KIND_GLYPH = 1u;
const uint KIND_ORIGINAL = 2u;

// per-splat state, written by modifySplatCenter and read by the hooks which run after it
uint rainKind;
vec3 rainHome;      // rest position of a glyph, the grid cell center when snapped
float rainFade;     // fade in and out of a falling glyph
vec3 rainPos;       // position before the turbulence, where the rain is evaluated

// PCG3D hash (Jarzynski & Olano)
uvec3 rainHash(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    v ^= v >> 16u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    return v;
}

// three random values in [0, 1)
vec3 rainRandom(uvec3 v) {
    return vec3(rainHash(v) >> 8u) / 16777216.0;
}

// x: trail brightness 0..1, y: 1 on the leading glyph of a drop
vec2 rainAt(vec3 p) {
    float size = uGlyph.y;
    vec3 h = rainRandom(uvec3(ivec3(floor(p.xz / size), 17)));    // per column of glyphs
    float spacing = uRain.y * mix(0.7, 1.3, h.y);
    float trail = uRain.x * mix(0.6, 1.4, h.z);
    float row = floor(p.y / size);
    float d = mod(row + uPhases.x * mix(0.6, 1.4, h.x) + h.x * spacing, spacing);  // rows above the drop head
    return vec2(d < trail ? pow(1.0 - d / trail, 2.0) : 0.0, d < 1.0 ? 1.0 : 0.0);
}

// smooth swirling offset of about -1..1: three octaves of moving sine waves, each warped by the
// octaves before it
vec3 rainTurbulence(vec3 p) {
    vec3 q = p * uTurb.y;
    vec3 o = vec3(0.0);
    float a = 1.0;
    for (int i = 0; i < 3; i++) {
        o += a * sin(q.yzx * 1.3 + o.zxy + uTurb.z * vec3(1.0, 1.3, 0.7) + float(i) * 1.7);
        q *= 2.1;
        a *= 0.5;
    }
    return o / 1.75;
}

void modifySplatCenter(inout vec3 center) {
    // stable per-splat random values, from the original position
    vec3 r = rainRandom(floatBitsToUint(center));
    rainFade = 1.0;

    if (r.x < uGlyph.x) {
        rainKind = KIND_GLYPH;
        float size = uGlyph.y;
        rainHome = uGlyph.z > 0.5 ? (floor(center / size) + 0.5) * size : center;
        center = rainHome;

        // each glyph falls through the fall distance centered on its home, fading in and out at
        // the ends so the wrap around is not visible
        if (uFallDistance > 0.0) {
            float phase = fract(uPhases.y + r.y);
            center.y += uFallDistance * (0.5 - phase);
            float fade = smoothstep(0.0, 0.2, phase) * smoothstep(1.0, 0.8, phase);
            rainFade = mix(1.0, fade, min(uFallDistance * 10.0, 1.0));
        }
    } else {
        rainKind = r.y < uOthers.x ? KIND_ORIGINAL : KIND_HIDDEN;
    }

    // the turbulence carries the glyphs, and the other splats by their own amount
    rainPos = center;
    float turbulence = rainKind == KIND_GLYPH ? uTurb.x : uTurb.x * uTurb.w;
    if (turbulence > 0.0 && rainKind != KIND_HIDDEN) {
        center += turbulence * rainTurbulence(center);
    }
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
    if (rainKind == KIND_GLYPH) {
        // the footprint reaches 2.83 sigma, so its inscribed square, which holds the glyph,
        // spans 4 sigma
        gsplatMakeSpherical(scale, uGlyph.y * 0.25);
    } else if (rainKind == KIND_ORIGINAL) {
        // shrink the large splats, so no axis exceeds the max size
        scale = min(scale, vec3(uOthers.y));
    } else {
        scale = vec3(0.0);
    }
}

void modifySplatColor(vec3 center, inout vec4 color) {
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec2 rain = rainAt(rainPos);

    if (rainKind == KIND_GLYPH) {
        float shade = mix(1.0, clamp(luma * 2.0, 0.0, 1.0), uGlyphLook.z);
        vec3 rgb = uGlyphColor * (uGlyphLook.y + rain.x) * shade;
        color.rgb = mix(rgb, uHeadColor, rain.y * uRain.z) * uGlyphLook.x;

        // the glyph changes at its own rate
        vec3 h = rainRandom(floatBitsToUint(rainHome));
        float swaps = floor(uPhases.z * mix(0.3, 1.7, h.x) + h.y * 8.0);
        uint glyph = rainHash(uvec3(floatBitsToUint(h.z), uint(swaps), 7u)).x % uint(uGlyph.w);

        // the glyph shape and opacity are applied per fragment, so keep the whole footprint
        uint alpha = uint(clamp(uGlyphLook.w * rainFade, 0.0, 1.0) * 255.0 + 0.5);
        setGlyphInfo(glyph | 64u | (alpha << 8u));
        color.a = 1.0;
    } else {
        // tint towards a monochrome version of the scene in the glyph color, lit up by the drops
        vec3 mono = uGlyphColor * luma * 2.0;
        color.rgb = mix(color.rgb, mono, uOthersLook.x) * uOthers.w * (1.0 + rain.x * uOthersLook.y * 4.0);
        color.a = rainKind == KIND_ORIGINAL ? color.a * uOthers.z : 0.0;
        setGlyphInfo(0u);
    }
}
`;

const shaderWGSL = /* wgsl */`
uniform uPhases: vec3f;       // x: rain (rows), y: fall (cycles), z: glyph swaps
uniform uGlyph: vec4f;        // x: fraction of splats which are glyphs, y: glyph size, z: snap to grid, w: glyph count
uniform uGlyphLook: vec4f;    // x: brightness, y: resting glow, z: scene shading, w: opacity
uniform uRain: vec3f;         // x: trail length (rows), y: drop spacing (rows), z: head intensity
uniform uFallDistance: f32;
uniform uOthers: vec4f;       // x: density, y: max size, z: opacity, w: brightness
uniform uOthersLook: vec2f;   // x: tint, y: rain response
uniform uGlyphColor: vec3f;
uniform uHeadColor: vec3f;
uniform uTurb: vec4f;         // x: amount, y: frequency, z: phase, w: amount for the other splats

const KIND_HIDDEN: u32 = 0u;
const KIND_GLYPH: u32 = 1u;
const KIND_ORIGINAL: u32 = 2u;

// per-splat state, written by modifySplatCenter and read by the hooks which run after it
var<private> rainKind: u32;
var<private> rainHome: vec3f;     // rest position of a glyph, the grid cell center when snapped
var<private> rainFade: f32;       // fade in and out of a falling glyph
var<private> rainPos: vec3f;      // position before the turbulence, where the rain is evaluated

// PCG3D hash (Jarzynski & Olano)
fn rainHash(p: vec3u) -> vec3u {
    var v = p * 1664525u + 1013904223u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    v ^= v >> vec3u(16u);
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    return v;
}

// three random values in [0, 1)
fn rainRandom(v: vec3u) -> vec3f {
    return vec3f(rainHash(v) >> vec3u(8u)) / 16777216.0;
}

// x: trail brightness 0..1, y: 1 on the leading glyph of a drop
fn rainAt(p: vec3f) -> vec2f {
    let size = uniform.uGlyph.y;
    let h = rainRandom(bitcast<vec3u>(vec3i(vec2i(floor(p.xz / size)), 17)));    // per column of glyphs
    let spacing = uniform.uRain.y * mix(0.7, 1.3, h.y);
    let trail = uniform.uRain.x * mix(0.6, 1.4, h.z);
    let row = floor(p.y / size);
    let x = row + uniform.uPhases.x * mix(0.6, 1.4, h.x) + h.x * spacing;
    let d = x - spacing * floor(x / spacing);                                     // rows above the drop head
    return vec2f(select(0.0, pow(1.0 - d / trail, 2.0), d < trail), select(0.0, 1.0, d < 1.0));
}

// smooth swirling offset of about -1..1: three octaves of moving sine waves, each warped by the
// octaves before it
fn rainTurbulence(p: vec3f) -> vec3f {
    var q = p * uniform.uTurb.y;
    var o = vec3f(0.0);
    var a = 1.0;
    for (var i = 0; i < 3; i++) {
        o += a * sin(q.yzx * 1.3 + o.zxy + uniform.uTurb.z * vec3f(1.0, 1.3, 0.7) + f32(i) * 1.7);
        q *= 2.1;
        a *= 0.5;
    }
    return o / 1.75;
}

fn modifySplatCenter(center: ptr<function, vec3f>) {
    // stable per-splat random values, from the original position
    let r = rainRandom(bitcast<vec3u>(*center));
    rainFade = 1.0;

    if (r.x < uniform.uGlyph.x) {
        rainKind = KIND_GLYPH;
        let size = uniform.uGlyph.y;
        rainHome = select(*center, (floor(*center / size) + 0.5) * size, uniform.uGlyph.z > 0.5);
        *center = rainHome;

        // each glyph falls through the fall distance centered on its home, fading in and out at
        // the ends so the wrap around is not visible
        if (uniform.uFallDistance > 0.0) {
            let phase = fract(uniform.uPhases.y + r.y);
            (*center).y += uniform.uFallDistance * (0.5 - phase);
            let fade = smoothstep(0.0, 0.2, phase) * smoothstep(1.0, 0.8, phase);
            rainFade = mix(1.0, fade, min(uniform.uFallDistance * 10.0, 1.0));
        }
    } else {
        rainKind = select(KIND_HIDDEN, KIND_ORIGINAL, r.y < uniform.uOthers.x);
    }

    // the turbulence carries the glyphs, and the other splats by their own amount
    rainPos = *center;
    let turbulence = select(uniform.uTurb.x * uniform.uTurb.w, uniform.uTurb.x, rainKind == KIND_GLYPH);
    if (turbulence > 0.0 && rainKind != KIND_HIDDEN) {
        *center += turbulence * rainTurbulence(rainPos);
    }
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
    if (rainKind == KIND_GLYPH) {
        // the footprint reaches 2.83 sigma, so its inscribed square, which holds the glyph,
        // spans 4 sigma
        gsplatMakeSpherical(scale, uniform.uGlyph.y * 0.25);
    } else if (rainKind == KIND_ORIGINAL) {
        // shrink the large splats, so no axis exceeds the max size
        *scale = min(*scale, vec3f(uniform.uOthers.y));
    } else {
        *scale = vec3f(0.0);
    }
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    let luma = dot((*color).rgb, vec3f(0.299, 0.587, 0.114));
    let rain = rainAt(rainPos);

    if (rainKind == KIND_GLYPH) {
        let shade = mix(1.0, clamp(luma * 2.0, 0.0, 1.0), uniform.uGlyphLook.z);
        let rgb = uniform.uGlyphColor * (uniform.uGlyphLook.y + rain.x) * shade;

        // the glyph changes at its own rate
        let h = rainRandom(bitcast<vec3u>(rainHome));
        let swaps = floor(uniform.uPhases.z * mix(0.3, 1.7, h.x) + h.y * 8.0);
        let glyph = rainHash(vec3u(bitcast<u32>(h.z), u32(swaps), 7u)).x % u32(uniform.uGlyph.w);

        // the glyph shape and opacity are applied per fragment, so keep the whole footprint
        let alpha = u32(clamp(uniform.uGlyphLook.w * rainFade, 0.0, 1.0) * 255.0 + 0.5);
        setGlyphInfo(glyph | 64u | (alpha << 8u));
        *color = vec4f(mix(rgb, uniform.uHeadColor, rain.y * uniform.uRain.z) * uniform.uGlyphLook.x, 1.0);
    } else {
        // tint towards a monochrome version of the scene in the glyph color, lit up by the drops
        let mono = uniform.uGlyphColor * luma * 2.0;
        let rgb = mix((*color).rgb, mono, uniform.uOthersLook.x) * uniform.uOthers.w * (1.0 + rain.x * uniform.uOthersLook.y * 4.0);
        let alpha = select(0.0, (*color).a * uniform.uOthers.z, rainKind == KIND_ORIGINAL);
        *color = vec4f(rgb, alpha);
        setGlyphInfo(0u);
    }
}
`;

const fragmentGLSL = /* glsl */`
uniform sampler2D uGlyphAtlas;   // 8 x 8 glyphs, white on black

void modifySplatColor(vec2 gaussianUV, inout vec4 color) {
    uint info = getGlyphInfo();

    // the glyph fills the square inscribed in the circular footprint
    vec2 g = gaussianUV * 1.41421356;
    float index = float(info & 63u);
    vec2 cell = clamp(g * 0.5 + 0.5, 0.0, 1.0);
    vec2 uv = (vec2(mod(index, 8.0), floor(index / 8.0)) + vec2(cell.x, 1.0 - cell.y)) / 8.0;

    // sampled before the branch, as derivatives are undefined in non-uniform control flow
    float mask = texture(uGlyphAtlas, uv).r;

    if ((info & 64u) != 0u) {
        float inside = step(max(abs(g.x), abs(g.y)), 1.0);
        color.a = mask * inside * float(info >> 8u) / 255.0;
    }
}
`;

const fragmentWGSL = /* wgsl */`
var uGlyphAtlas: texture_2d<f32>;   // 8 x 8 glyphs, white on black
var uGlyphAtlasSampler: sampler;

fn modifySplatColor(gaussianUV: vec2f, color: ptr<function, vec4f>) {
    let info = getGlyphInfo();

    // the glyph fills the square inscribed in the circular footprint
    let g = gaussianUV * 1.41421356;
    let index = f32(info & 63u);
    let cell = clamp(g * 0.5 + 0.5, vec2f(0.0), vec2f(1.0));
    let uv = (vec2f(index % 8.0, floor(index / 8.0)) + vec2f(cell.x, 1.0 - cell.y)) / 8.0;

    // sampled before the branch, as derivatives are not allowed in non-uniform control flow
    let mask = textureSample(uGlyphAtlas, uGlyphAtlasSampler, uv).r;

    if ((info & 64u) != 0u) {
        let inside = step(max(abs(g.x), abs(g.y)), 1.0);
        *color = vec4f((*color).rgb, mask * inside * f32(info >> 8u) / 255.0);
    }
}
`;

/**
 * Digital rain shader effect for gaussian splats.
 *
 * A fraction of the splats become camera facing glyphs, optionally snapped to a grid, lit by
 * drops running down columns of glyphs, while the remaining splats are thinned, shrunk and tinted.
 * Glyphs can also fall or rise continuously, and a turbulence field can swirl the glyphs and the
 * other splats. The vertex stage classifies each splat and picks its glyph, which it passes to
 * the fragment stage in a custom varying, where the glyph replaces the gaussian falloff. The
 * glyphs are drawn into an atlas texture from {@link glyphs} using {@link font}.
 *
 * Sizes and distances are in world units, and the rain falls down the world Y axis. The effect
 * needs a unified gsplat component, as it uses a custom varying, and it replaces the
 * gsplatModifyVS and gsplatModifyPS chunks of the scene-wide gsplat material, so it does not
 * combine with other gsplat shader effects. Every property can be changed at any time, and the
 * animation advances by accumulated phases, so changing a speed does not make it jump.
 *
 * @example
 * // Add the script to a gsplat entity
 * entity.addComponent('script');
 * const rain = entity.script.create(GSplatGlyphRainShaderEffect);
 * rain.glyphColor.set(0, 1, 0.3);
 * rain.turbulence = 0.05;
 * @category Gaussian Splatting
 */
class GSplatGlyphRainShaderEffect extends GSplatShaderEffect {
    static scriptName = 'gsplatGlyphRainShaderEffect';

    /**
     * The glyphs to pick from, up to 64 characters.
     * @attribute
     */
    glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789Z:.=*+-<>';

    /**
     * The CSS font family the glyphs are drawn with.
     * @attribute
     */
    font = '"MS Gothic", "Hiragino Sans", "Noto Sans JP", monospace';

    /**
     * Whether the glyphs are mirrored horizontally.
     * @attribute
     */
    mirror = true;

    /**
     * Fraction of the splats which become glyphs.
     * @attribute
     * @range [0, 1]
     */
    glyphFraction = 0.08;

    /**
     * Size of a glyph, and of a grid cell, in world units.
     * @attribute
     */
    glyphSize = 0.04;

    /**
     * Whether the glyphs snap to the centers of a grid of glyph sized cells.
     * @attribute
     */
    snapToGrid = true;

    /**
     * Average number of times per second each glyph changes.
     * @attribute
     */
    swapRate = 1.5;

    /**
     * Brightness multiplier of the glyphs.
     * @attribute
     */
    glyphBrightness = 1.5;

    /**
     * Brightness of the glyphs outside the drop trails, relative to the trail.
     * @attribute
     * @range [0, 1]
     */
    restingGlow = 0.15;

    /**
     * How much the brightness of the scene under a glyph shades it.
     * @attribute
     * @range [0, 1]
     */
    sceneShading = 0.6;

    /**
     * Opacity of the glyphs.
     * @attribute
     * @range [0, 1]
     */
    glyphOpacity = 1;

    /**
     * Color of the glyphs (values above 1 glow with bloom).
     * @attribute
     */
    glyphColor = new Color(1, 0.4, 0);

    /**
     * Color of the leading glyph of each drop.
     * @attribute
     */
    headColor = new Color(1, 0.85, 0.7);

    /**
     * Speed of the drops, in glyph rows per second.
     * @attribute
     */
    rainSpeed = 15;

    /**
     * Length of a drop trail, in glyph rows.
     * @attribute
     */
    trailLength = 14;

    /**
     * Average distance between drops in a column, in glyph rows.
     * @attribute
     */
    dropSpacing = 50;

    /**
     * How strongly the leading glyph of a drop takes the head color.
     * @attribute
     * @range [0, 1]
     */
    headIntensity = 1;

    /**
     * Distance each glyph falls before it wraps around, in world units. 0 keeps the glyphs in
     * place.
     * @attribute
     */
    fallDistance = 0;

    /**
     * Speed of the falling glyphs, in world units per second. Negative values make them rise.
     * @attribute
     */
    fallSpeed = 0.3;

    /**
     * Fraction of the splats which are not glyphs that stay visible.
     * @attribute
     * @range [0, 1]
     */
    otherDensity = 0.5;

    /**
     * Maximum scale of the splats which are not glyphs, in world units.
     * @attribute
     */
    otherMaxSize = 0.003;

    /**
     * Opacity multiplier of the splats which are not glyphs.
     * @attribute
     * @range [0, 1]
     */
    otherOpacity = 0.6;

    /**
     * Brightness multiplier of the splats which are not glyphs.
     * @attribute
     */
    otherBrightness = 0.25;

    /**
     * How much the splats which are not glyphs are tinted towards a monochrome version of the
     * scene in the glyph color.
     * @attribute
     * @range [0, 1]
     */
    otherTint = 1;

    /**
     * How much the drops light up the splats which are not glyphs.
     * @attribute
     */
    otherRainResponse = 0.5;

    /**
     * Distance the turbulence moves the glyphs, in world units. 0 disables it.
     * @attribute
     */
    turbulence = 0;

    /**
     * Size of the turbulence swirls, in world units.
     * @attribute
     */
    turbulenceScale = 0.5;

    /**
     * Speed of the turbulence.
     * @attribute
     */
    turbulenceSpeed = 0.5;

    /**
     * How much the turbulence moves the splats which are not glyphs, relative to the glyphs.
     * @attribute
     * @range [0, 1]
     */
    turbulenceOthers = 0;

    /**
     * Whether the rain, falling glyphs, glyph swaps and turbulence animate.
     * @attribute
     */
    animate = true;

    /** @type {Texture|null} */
    _atlas = null;

    _atlasKey = '';

    _glyphCount = 1;

    _rainPhase = 0;

    _fallPhase = 0;

    _swapPhase = 0;

    _turbPhase = 0;

    // Reusable arrays for uniform updates
    _phases = [0, 0, 0];

    _glyph = [0, 0, 0, 0];

    _glyphLook = [0, 0, 0, 0];

    _rain = [0, 0, 0];

    _others = [0, 0, 0, 0];

    _othersLook = [0, 0];

    _glyphColor = [0, 0, 0];

    _headColor = [0, 0, 0];

    _turb = [0, 0, 0, 0];

    getShaderGLSL() {
        return shaderGLSL;
    }

    getShaderWGSL() {
        return shaderWGSL;
    }

    getFragmentShaderGLSL() {
        return fragmentGLSL;
    }

    getFragmentShaderWGSL() {
        return fragmentWGSL;
    }

    applyToComponentMaterial() {
        console.warn(`${this.constructor.name}: needs a unified gsplat component, as it uses a custom varying.`);
    }

    applyShaderToMaterial(material) {
        const varyings = this.app.scene.gsplat.varyings;
        if (!varyings.streams.some(s => s.name === VARYING)) {
            varyings.add([{ name: VARYING, type: TYPE_UINT32, components: 1 }]);
        }
        this._updateAtlas();
        material.setParameter('uGlyphAtlas', this._atlas);
        super.applyShaderToMaterial(material);
    }

    removeShaders() {
        if (this.material) {
            this.app.scene.gsplat.varyings.remove([VARYING]);
        }
        super.removeShaders();
    }

    destroy() {
        super.destroy();
        this._atlas?.destroy();
        this._atlas = null;
    }

    /**
     * Draws the glyphs into the atlas texture, when they or their font have changed.
     *
     * @private
     */
    _updateAtlas() {
        const glyphs = [...this.glyphs].slice(0, 64);
        const key = `${glyphs.join('')}|${this.font}|${this.mirror}`;
        if (this._atlas && key === this._atlasKey) return;
        this._atlasKey = key;
        this._glyphCount = Math.max(glyphs.length, 1);

        // a new canvas each time, as setting the same source again does not upload it
        const cellSize = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = cellSize * 8;
        const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.round(cellSize * 0.8)}px ${this.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        glyphs.forEach((glyph, i) => {
            ctx.save();
            ctx.translate((i % 8 + 0.5) * cellSize, (Math.floor(i / 8) + 0.5) * cellSize);
            ctx.scale(this.mirror ? -1 : 1, 1);
            ctx.fillText(glyph, 0, 0);
            ctx.restore();
        });

        this._atlas ??= new Texture(this.app.graphicsDevice, {
            name: 'glyph-rain-atlas',
            width: canvas.width,
            height: canvas.height,
            format: PIXELFORMAT_RGBA8,
            mipmaps: true,
            minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        this._atlas.setSource(canvas);
    }

    updateEffect(effectTime, dt) {
        this._updateAtlas();

        // accumulate the phases, so that changing a speed does not make the animation jump
        if (this.animate) {
            this._rainPhase += dt * this.rainSpeed;
            this._swapPhase += dt * this.swapRate;
            this._fallPhase = (this._fallPhase + dt * this.fallSpeed / Math.max(this.fallDistance, 0.1)) % 1;
            this._turbPhase += dt * this.turbulenceSpeed;
        }

        this.setUniform('uPhases', set(this._phases, this._rainPhase, this._fallPhase, this._swapPhase));
        this.setUniform('uGlyph', set(this._glyph, this.glyphFraction, this.glyphSize, this.snapToGrid ? 1 : 0, this._glyphCount));
        this.setUniform('uGlyphLook', set(this._glyphLook, this.glyphBrightness, this.restingGlow, this.sceneShading, this.glyphOpacity));
        this.setUniform('uRain', set(this._rain, this.trailLength, this.dropSpacing, this.headIntensity));
        this.setUniform('uFallDistance', this.fallDistance);
        this.setUniform('uOthers', set(this._others, this.otherDensity, this.otherMaxSize, this.otherOpacity, this.otherBrightness));
        this.setUniform('uOthersLook', set(this._othersLook, this.otherTint, this.otherRainResponse));
        this.setUniform('uGlyphColor', set(this._glyphColor, this.glyphColor.r, this.glyphColor.g, this.glyphColor.b));
        this.setUniform('uHeadColor', set(this._headColor, this.headColor.r, this.headColor.g, this.headColor.b));
        this.setUniform('uTurb', set(this._turb, this.turbulence, 1 / Math.max(this.turbulenceScale, 0.01), this._turbPhase, this.turbulenceOthers));
        this.setUniform('uGlyphAtlas', this._atlas);
    }
}

export { GSplatGlyphRainShaderEffect };
