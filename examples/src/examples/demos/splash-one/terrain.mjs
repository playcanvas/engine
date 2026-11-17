// The terrain of the Splash One demo - farmland and forest on the islands and coasts of a shallow
// sea, inside a ring of mountains, reaching out to the horizon.
//
// The height comes from a seeded noise function, sampled once into a grid. The grid is evenly spaced
// over the combat area and stretches out exponentially beyond it, so a single mesh covers forty
// kilometers in every direction - fine where the player flies, coarse on the mountains at the horizon,
// which are only ever seen through haze. It is cut into tiles, so the camera and the shadow cascades
// only draw the parts they can see.
//
// The surface's color is worked out per pixel from the world position and the slope - patchwork
// fields on the flat lowland, forest, rock on the steep faces, scree below them, sand along the
// water. Scanned material textures add the detail of each up close: hex tiled, each tile turned and
// shifted at random so they never repeat in a grid, blended into larger copies of themselves further
// away, and gone in the distance, where the color alone keeps the landscape sharp at any altitude.
// The forest has no texture - its trees are drawn one by one, each crown lit by the sun on one side
// and casting a shadow on the ground beside it.
//
// Everything in the game that needs to know where the ground is asks heightAt, which interpolates the
// very triangles that are drawn, so wrecks and vehicles sit exactly on the visible surface.

import {
    ADDRESS_REPEAT,
    BLEND_NORMAL,
    Entity,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    Mesh,
    MeshInstance,
    PIXELFORMAT_RGBA8,
    PIXELFORMAT_SRGBA8,
    PRIMITIVE_TRIANGLES,
    PlaneGeometry,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL,
    ShaderMaterial,
    StandardMaterial,
    Texture,
    Vec2,
    math
} from 'playcanvas';

import { applyAtmosphere, atmosphereChunks } from './atmosphere.mjs';

/**
 * @import { AppBase, Asset, Color, GraphicsDevice, Layer, Vec3 } from 'playcanvas'
 */

// the grid - evenly spaced over the combat area, then stretching exponentially out to the horizon
const GRID_QUADS = 640;
const INNER_QUADS = 512;
const INNER_SPACING = 32;
const OUTER_EXTENT = 40000;
const TILE_QUADS = 64;

// the combat area, out to where the grid starts to stretch
export const COMBAT_RADIUS = (INNER_QUADS / 2) * INNER_SPACING;

const MAX_SITES = 8;

// the mountain massifs inside the combat area - about how far apart they are, in meters, and how high
// they rise, relative to the ring of mountains at the horizon
const MASSIF_SIZE = 5600;
const MASSIF_HEIGHT = 0.8;

// how far from the start the massifs keep, in meters
const MASSIF_CLEARANCE = 2000;

// The textured layers of the ground - scanned materials from Poly Haven (CC0), credited in
// assets/textures/terrain/polyhaven.credits.txt. Each has the mean linear albedo of its texture, which
// the shader divides by so the texture varies the landscape's color rather than replacing it, and the
// size of one tile, in meters - a little under the scanned size, apart from the two meter patch of
// sparse grass, which is stretched to read from the air.
export const TERRAIN_LAYERS = [
    { name: 'aerial_grass_rock', mean: [0.1695, 0.1217, 0.0262], size: 15 },
    { name: 'sparse_grass', mean: [0.0804, 0.0481, 0.008], size: 5 },
    { name: 'dirt_aerial_02', mean: [0.2066, 0.1175, 0.0552], size: 20 },
    { name: 'aerial_rocks_02', mean: [0.1695, 0.1196, 0.0495], size: 35 },
    { name: 'aerial_beach_01', mean: [0.2826, 0.2371, 0.1959], size: 30 },
    { name: 'rock_face_03', mean: [0.2323, 0.1455, 0.0838], size: 26 }
];
const LAYER_COUNT = TERRAIN_LAYERS.length;

// the layers the shader picks out, and the trees, which have no texture and come after the layers
const SOIL = 2;
const ROCK = 3;
const SAND = 4;
// the scan of a cliff face, for the upright sides of the rock
const CLIFF = 5;
const TREES = LAYER_COUNT;

/**
 * Builds the texture arrays of the ground's layers - their albedo, and their normal maps.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {Asset[]} albedo - The albedo texture assets, in the order of TERRAIN_LAYERS.
 * @param {Asset[]} normal - The normal map texture assets, in the same order.
 * @returns {{ albedo: Texture, normal: Texture }} The arrays.
 */
export const createTerrainMaps = (device, albedo, normal) => {
    const array = (name, assets, format) =>
        new Texture(device, {
            name,
            width: 1024,
            height: 1024,
            format,
            arrayLength: assets.length,
            mipmaps: true,
            minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_REPEAT,
            addressV: ADDRESS_REPEAT,
            anisotropy: 8,
            levels: [assets.map((asset) => asset.resource.getSource())]
        });
    return {
        albedo: array('TerrainAlbedo', albedo, PIXELFORMAT_SRGBA8),
        normal: array('TerrainNormal', normal, PIXELFORMAT_RGBA8)
    };
};

// --------------------------------------------------------------------------------------------
// noise

const GRADIENTS = new Float32Array([
    1, 0, -1, 0, 0, 1, 0, -1, 0.7071, 0.7071, -0.7071, 0.7071, 0.7071, -0.7071, -0.7071, -0.7071
]);

/**
 * Creates seeded 2D gradient noise.
 *
 * @param {number} seed - The seed.
 * @returns {(x: number, y: number, period?: number) => number} Noise between roughly minus one and
 * one, which repeats every `period` units when a period is given.
 */
const createNoise = (seed) => {
    const hash = (x, y) => {
        let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x2545f491);
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        return (h ^ (h >>> 16)) & 7;
    };

    return (x, y, period = 0) => {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const xf = x - xi;
        const yf = y - yi;
        const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
        const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

        // wrapping the lattice makes the noise tile
        const x0 = period ? ((xi % period) + period) % period : xi;
        const y0 = period ? ((yi % period) + period) % period : yi;
        const x1 = period ? (x0 + 1) % period : xi + 1;
        const y1 = period ? (y0 + 1) % period : yi + 1;

        const g00 = hash(x0, y0) * 2;
        const g10 = hash(x1, y0) * 2;
        const g01 = hash(x0, y1) * 2;
        const g11 = hash(x1, y1) * 2;

        const n00 = GRADIENTS[g00] * xf + GRADIENTS[g00 + 1] * yf;
        const n10 = GRADIENTS[g10] * (xf - 1) + GRADIENTS[g10 + 1] * yf;
        const n01 = GRADIENTS[g01] * xf + GRADIENTS[g01 + 1] * (yf - 1);
        const n11 = GRADIENTS[g11] * (xf - 1) + GRADIENTS[g11 + 1] * (yf - 1);

        const a = n00 + (n10 - n00) * u;
        const b = n01 + (n11 - n01) * u;
        return (a + (b - a) * v) * 1.6;
    };
};

// --------------------------------------------------------------------------------------------
// the surface shader

const terrainGLSL = /* glsl */ `
    uniform sampler2D terrainNoiseMap;
    uniform mediump sampler2DArray terrainAlbedoMaps;
    uniform mediump sampler2DArray terrainNormalMaps;
    uniform vec4 terrainSites[${MAX_SITES}];

    // per layer - the mean albedo of its texture, and the size of one tile of it, in meters
    uniform vec4 terrainLayers[${LAYER_COUNT}];

    // the normal maps of the layers, blended in getAlbedo for getNormal - x and z on the ground
    vec2 terrainDetailNormal;

    // the bend of the normal of the rock - from the cliff scan's normal map on the upright faces, and
    // the relief of the gullies - in the world, as the faces' own tangents do not line up with x and z
    vec3 terrainRockNormal;

    float terrainHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    vec2 terrainHash2(vec2 p) {
        return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
    }

    vec2 terrainRotate(vec2 v, float a) {
        float c = cos(a);
        float s = sin(a);
        return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
    }

    // How a layer's texture differs from its mean - its brightness in full, and its tint only in part,
    // measured with a floor, so a channel that is nearly black on average (the blue of grass) does not
    // turn a few bright texels into sparkles.
    vec3 terrainRatio(vec3 albedo, vec3 mean) {
        const vec3 luma = vec3(0.2126, 0.7152, 0.0722);
        float a = dot(albedo, luma);
        float m = dot(mean, luma);
        vec3 tint = ((albedo + 0.03) / (a + 0.03)) / ((mean + 0.03) / (m + 0.03));
        return a / m * mix(vec3(1.0), clamp(tint, vec3(0.6), vec3(1.6)), 0.6);
    }

    // One texture sample of a layer, with its own rotation and offset, and the gradients turned to
    // match, so the mip level is right at the seams between the samples.
    void terrainSample(float layer, vec2 st, vec2 dx, vec2 dy, float angle, vec2 offset, out vec3 albedo, out vec2 normal) {
        vec2 uv = terrainRotate(st, angle) + offset;
        vec2 gx = terrainRotate(dx, angle);
        vec2 gy = terrainRotate(dy, angle);
        albedo = textureGrad(terrainAlbedoMaps, vec3(uv, layer), gx, gy).rgb;
        normal = terrainRotate(textureGrad(terrainNormalMaps, vec3(uv, layer), gx, gy).xy * 2.0 - 1.0, -angle);
    }

    // Hex tiling - a grid of hexagons, each with its own random turn and shift of a texture, blended
    // over the triangles between their centers, so the texture never lines up into a repeating grid
    // (after Mikkelsen, Practical Real-Time Hex-Tiling, and Heitz and Neyret's triangle grid). Returns
    // the weights of the three hexagons around a point, and where they are in the grid.
    vec3 terrainHexGrid(vec2 st, out vec2 v1, out vec2 v2, out vec2 v3) {
        vec2 grid = st * 3.4641016;
        vec2 skewed = vec2(grid.x, grid.y * 1.15470054 - grid.x * 0.57735027);
        vec2 base = floor(skewed);
        vec3 f = vec3(fract(skewed), 0.0);
        f.z = 1.0 - f.x - f.y;
        if (f.z > 0.0) {
            v1 = base; v2 = base + vec2(0.0, 1.0); v3 = base + vec2(1.0, 0.0);
            return vec3(f.z, f.y, f.x);
        }
        v1 = base + vec2(1.0); v2 = base + vec2(1.0, 0.0); v3 = base + vec2(0.0, 1.0);
        return vec3(-f.z, 1.0 - f.y, 1.0 - f.x);
    }

    // a layer's texture, hex tiled
    void terrainHexSample(float layer, vec2 st, vec2 dx, vec2 dy, out vec3 albedo, out vec2 normal) {
        vec2 v1, v2, v3;
        vec3 w = pow(terrainHexGrid(st, v1, v2, v3), vec3(6.0));
        w /= w.x + w.y + w.z;

        vec3 a1, a2, a3;
        vec2 n1, n2, n3;
        terrainSample(layer, st, dx, dy, terrainHash(v1 + layer) * 6.2832, terrainHash2(v1 * 1.7 + layer), a1, n1);
        terrainSample(layer, st, dx, dy, terrainHash(v2 + layer) * 6.2832, terrainHash2(v2 * 1.7 + layer), a2, n2);
        terrainSample(layer, st, dx, dy, terrainHash(v3 + layer) * 6.2832, terrainHash2(v3 * 1.7 + layer), a3, n3);
        albedo = a1 * w.x + a2 * w.y + a3 * w.z;
        normal = n1 * w.x + n2 * w.y + n3 * w.z;
    }

    // The noise map at a scale, as the sum of two copies of it, turned apart and a little larger and
    // smaller than the scale - their periods share no common multiple, so the sum never repeats in a
    // grid. The sum is stretched back out to the spread of a single sample.
    vec4 terrainNoise(vec2 p, float scale) {
        vec2 a = mat2(0.8776, 0.4794, -0.4794, 0.8776) * p / (scale * 0.79);
        vec2 b = mat2(-0.5048, 0.8632, -0.8632, -0.5048) * p / (scale * 1.27) + 0.37;
        vec4 n = texture2D(terrainNoiseMap, a) + texture2D(terrainNoiseMap, b);
        return clamp((n - 1.0) * 0.7071 + 0.5, 0.0, 1.0);
    }

    // terrainNoise at the mip level of a pixel's footprint on the ground, so it can be sampled in a
    // branch, where the derivatives the plain one relies on are not defined
    vec4 terrainNoiseLod(vec2 p, float scale, float footprint) {
        float sa = scale * 0.79;
        float sb = scale * 1.27;
        vec2 a = mat2(0.8776, 0.4794, -0.4794, 0.8776) * p / sa;
        vec2 b = mat2(-0.5048, 0.8632, -0.8632, -0.5048) * p / sb + 0.37;
        vec4 n = texture2DLod(terrainNoiseMap, a, log2(max(footprint * 256.0 / sa, 1.0))) +
                 texture2DLod(terrainNoiseMap, b, log2(max(footprint * 256.0 / sb, 1.0)));
        return clamp((n - 1.0) * 0.7071 + 0.5, 0.0, 1.0);
    }

    // noise stretched upright on the two upright planes, mixed by which one a face looks along - the
    // gullies and the streaks the water leaves running down the faces of the rock
    float terrainStreaks(vec3 pos, vec3 N, float scale, float footprint) {
        vec2 w = abs(N.xz) + 0.001;
        w /= w.x + w.y;
        float alongX = terrainNoiseLod(vec2(pos.z, pos.y * 0.2), scale, footprint).r;
        float alongZ = terrainNoiseLod(vec2(pos.x, pos.y * 0.2), scale, footprint).r;
        return alongX * w.x + alongZ * w.y;
    }

    // Bare rock - in broad bands of darker and lighter gray along its strata, which tilt and waver, with
    // patches of buff and of ochre staining, streaked dark down the faces by gullies, and with a little
    // lichen where it is not too steep. The gullies also bend the normal across the face - a relief the coarse
    // grid of the terrain is far too smooth to have - returned in tilt, in the world.
    vec3 terrainStone(vec3 pos, vec3 N, vec4 broad, vec4 medium, float footprint, out vec3 tilt) {
        float level = pos.y + (broad.r - 0.5) * 160.0;
        float bands = terrainNoiseLod(vec2(level, 17.3), 70.0, footprint).b;
        vec3 stone = mix(vec3(0.065, 0.062, 0.058), vec3(0.13, 0.122, 0.108), bands);
        stone = mix(stone, vec3(0.18, 0.168, 0.145), smoothstep(0.58, 0.8, broad.b) * 0.7);
        stone = mix(stone, vec3(0.16, 0.115, 0.07), smoothstep(0.62, 0.8, medium.r) * 0.35);

        // the dark streaks down the faces, and the broad gullies they run in
        float streak = terrainStreaks(pos, N, 45.0, footprint);
        stone *= 1.0 - smoothstep(0.52, 0.72, streak) * 0.25;
        vec3 across = normalize(vec3(-N.z, 0.0, N.x) + vec3(1e-4, 0.0, 0.0));
        float gully = terrainStreaks(pos, N, 80.0, footprint);
        float next = terrainStreaks(pos + across * 6.0, N, 80.0, footprint);
        tilt = -across * clamp((next - gully) * 3.0, -0.3, 0.3);

        float lichen = smoothstep(0.55, 0.75, medium.a) * (1.0 - smoothstep(0.3, 0.55, 1.0 - N.y));
        return mix(stone, vec3(0.075, 0.085, 0.045), lichen * 0.45);
    }

    // four values in 0..1 for a cell, from multiplies alone, without the cost of a sine (after Dave
    // Hoskins, Hash without Sine) - the crowns hash every cell around a pixel
    vec4 terrainHash4(vec2 p) {
        vec4 p4 = fract(p.xyxy * vec4(0.1031, 0.103, 0.0973, 0.1099));
        p4 += dot(p4, p4.wzxy + 33.33);
        return fract((p4.xxyz + p4.yzzw) * p4.zywx);
    }

    // The highest tree crown over a point, in a jittered grid of crowns seven meters apart, of varied
    // size and ragged outline, with fewer of them where the forest thins out. Returns the crown's
    // height squared, which is zero where no crown covers the point, and its offset from the point,
    // radius and id.
    float terrainCrownTop(vec2 cs, float density, out vec2 offset, out float radius, out vec2 id) {
        vec2 base = floor(cs);
        vec2 f = fract(cs);
        float top = 0.0;
        offset = vec2(0.0);
        radius = 1.0;
        id = vec2(0.0);
        for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
                vec2 cell = base + vec2(float(i), float(j));
                vec4 hash = terrainHash4(cell);
                if (hash.w < density * 1.4 - 0.3) {
                    vec2 o = f - vec2(float(i), float(j)) - 0.15 - hash.xy * 0.7;
                    // A ragged outline of five and three lobes - Chebyshev polynomials of the direction
                    // give the cosines of its multiples without an angle, and swapping and mirroring
                    // the direction turns the lobes from crown to crown.
                    vec2 dir = o * inversesqrt(dot(o, o) + 0.000001);
                    dir = hash.z > 0.5 ? dir : dir.yx;
                    float c = fract(hash.z * 7.0) > 0.5 ? dir.x : -dir.x;
                    float lobes = c * (16.0 * c * c * c * c - 20.0 * c * c + 5.0) * 0.1 + dir.y * (4.0 * dir.y * dir.y - 3.0) * 0.06;
                    float r = (0.42 + 0.3 * fract(hash.z * 13.0)) * (1.0 + lobes);
                    // the highest crown over the point - a dome's height squared is r^2 - d^2
                    float height = r * r - dot(o, o);
                    if (height > top) {
                        top = height;
                        offset = o;
                        radius = r;
                        id = cell;
                    }
                }
            }
        }
        return top;
    }

    // Tree crowns, each a cluster of smaller clumps of leaves. The crowns are domes that bend the
    // normal, so the sun lights one side of each and leaves the other in shade, and they cast their
    // shadows on the ground between them, which is most of what makes a forest read from the air.
    // Returns how much of the point is under a crown, with the crown's albedo relative to the forest's
    // color and its normal, and how much of the ground there is in the shadow of the trees. The sun's
    // direction comes from the atmosphere's chunks.
    float terrainCrowns(vec2 p, float footprint, float density, out vec3 shade, out vec2 normal, out float shadow) {
        // the edges of the crowns and of their shadows are softened over a pixel
        float soft = 2.0 * footprint / 7.0 + 0.0001;

        // the shadow, from crowns about fifteen meters up
        shadow = 0.0;
        // the sun's direction in the world - the sky's own is mirrored on x
        vec3 sun = vec3(-dynSkySunDir.x, dynSkySunDir.y, dynSkySunDir.z);
        vec2 offset;
        float radius;
        vec2 id;
        if (sun.y > 0.02) {
            vec2 reach = sun.xz / max(sun.y, 0.3) * 15.0;
            float caster = terrainCrownTop((p + reach) / 7.0, density, offset, radius, id);
            shadow = clamp(caster / (radius * soft), 0.0, 1.0) * smoothstep(0.02, 0.15, sun.y);
        }

        float top = terrainCrownTop(p / 7.0, density, offset, radius, id);
        shade = vec3(1.0);
        normal = vec2(0.0);
        if (top <= 0.0) {
            return 0.0;
        }
        float h = sqrt(top);
        vec4 hash = terrainHash4(id + 0.5);
        shade = vec3(0.7 + 0.6 * hash.x);
        // a few broadleaf trees lighter and yellower, a few conifers darker and bluer
        float kind = hash.y;
        shade *= kind > 0.85 ? vec3(1.2, 1.1, 0.75) : kind < 0.2 ? vec3(0.8, 0.9, 1.0) : vec3(1.0);
        shade *= 0.65 + 0.35 * h / radius;
        normal = vec2(offset.x, -offset.y) / max(h, 0.35 * radius) * 0.5;

        // the clumps of leaves, close up
        float clumps = 1.0 - smoothstep(0.25, 0.9, footprint);
        if (clumps > 0.0) {
            vec2 cq = p / 2.2 + id * 3.7;
            vec2 cb = floor(cq);
            vec2 cf = fract(cq);
            float near = 8.0;
            float next = 8.0;
            vec2 co = vec2(0.0);
            for (int j = -1; j <= 1; j++) {
                for (int i = -1; i <= 1; i++) {
                    vec2 o = cf - vec2(float(i), float(j)) - terrainHash4(cb + vec2(float(i), float(j))).xy;
                    float d = dot(o, o);
                    if (d < near) {
                        next = near;
                        near = d;
                        co = o;
                    } else if (d < next) {
                        next = d;
                    }
                }
            }
            // each clump a soft bump, its tilt gone by the border with the next, so there is no crease
            float edge = smoothstep(0.0, 0.2, sqrt(next) - sqrt(near));
            shade *= mix(1.0, 0.82 + 0.3 * (1.0 - min(near * 2.0, 1.0)), clumps);
            normal += vec2(co.x, -co.y) * 0.45 * edge * clumps;
        }

        // the mean of the shades is about 0.88
        shade /= 0.88;
        return clamp(top / (radius * soft), 0.0, 1.0);
    }

    // A layer's detail at a point, at whichever of three scales of its texture is resolved at this
    // distance - its own size near the ground, eight times larger hex tiled from a few hundred meters,
    // and sixty four times larger, in two turned copies, further out - so there is detail at any
    // altitude, and the texture never repeats in a grid. Returns the albedo relative to the layer's
    // mean, so it varies the color of the landscape rather than replacing it.
    void terrainLayer(int index, float weight, vec2 p, vec2 dpx, vec2 dpy, float footprint, float turn, inout vec3 ratio, inout vec2 normal) {
        vec4 info = terrainLayers[index];
        float size = info.w;
        float texel = size / 1024.0;
        float fade = 1.0 - smoothstep(texel * 64.0 * 1.5, texel * 64.0 * 10.0, footprint);
        if (fade <= 0.0) {
            ratio += weight;
            return;
        }
        float layer = float(index);
        vec2 q = terrainRotate(p, turn);
        vec2 qx = terrainRotate(dpx, turn);
        vec2 qy = terrainRotate(dpy, turn);
        float toMid = smoothstep(texel * 1.5, texel * 6.0, footprint);
        float toFar = smoothstep(texel * 12.0, texel * 48.0, footprint);

        vec3 albedo = vec3(0.0);
        vec2 nrm = vec2(0.0);
        vec3 a;
        vec2 n;
        if (toMid < 0.99) {
            terrainSample(layer, q / size, qx / size, qy / size, 0.37 + layer, vec2(0.0), a, n);
            albedo += a * (1.0 - toMid);
            nrm += n * (1.0 - toMid);
        }
        if (toMid > 0.01 && toFar < 0.99) {
            float mid = size * 8.0;
            terrainHexSample(layer, q / mid, qx / mid, qy / mid, a, n);
            float k = toMid * (1.0 - toFar);
            albedo += a * k;
            nrm += n * 0.6 * k;
        }
        if (toFar > 0.01) {
            float far = size * 64.0;
            vec3 b;
            vec2 m;
            terrainSample(layer, q / far, qx / far, qy / far, 0.61 + layer, vec2(0.37, 0.71) * layer, a, n);
            terrainSample(layer, q / (far * 1.37), qx / (far * 1.37), qy / (far * 1.37), 2.3 + layer, vec2(0.13, 0.52), b, m);
            albedo += (a + b) * 0.5 * toMid * toFar;
            nrm += (n + m) * 0.2 * toMid * toFar;
        }
        ratio += weight * mix(vec3(1.0), terrainRatio(albedo, info.rgb), fade);
        normal += weight * fade * terrainRotate(nrm, -turn);
    }

    // Rock, projected from three sides, so it does not stretch down the cliffs - the aerial scan from
    // above, and the scan of a cliff face on the two upright sides, its normal map bending the normal
    // in the world. Each is measured against its own mean. Hex tiled close up, so neither repeats.
    void terrainRockPlanes(float rockSize, float cliffSize, bool hex, vec3 pos, vec3 dpx, vec3 dpy, vec3 blend, float k,
                           inout vec3 ratio, inout vec2 normal, inout vec3 world) {
        vec3 rockMean = terrainLayers[${ROCK}].rgb;
        vec3 cliffMean = terrainLayers[${CLIFF}].rgb;
        vec3 a;
        vec2 n;
        if (blend.y > 0.02) {
            if (hex) {
                terrainHexSample(${ROCK}.0, pos.xz / rockSize, dpx.xz / rockSize, dpy.xz / rockSize, a, n);
            } else {
                terrainSample(${ROCK}.0, pos.xz / rockSize, dpx.xz / rockSize, dpy.xz / rockSize, 0.3, vec2(0.0), a, n);
            }
            ratio += terrainRatio(a, rockMean) * blend.y * k;
            normal += n * blend.y * k;
        }
        if (blend.x > 0.02) {
            if (hex) {
                terrainHexSample(${CLIFF}.0, pos.zy / cliffSize + 0.5, dpx.zy / cliffSize, dpy.zy / cliffSize, a, n);
            } else {
                terrainSample(${CLIFF}.0, pos.zy / cliffSize, dpx.zy / cliffSize, dpy.zy / cliffSize, 0.0, vec2(0.5), a, n);
            }
            ratio += terrainRatio(a, cliffMean) * blend.x * k;
            world += vec3(0.0, n.y, n.x) * blend.x * k;
        }
        if (blend.z > 0.02) {
            if (hex) {
                terrainHexSample(${CLIFF}.0, pos.xy / cliffSize + 0.25, dpx.xy / cliffSize, dpy.xy / cliffSize, a, n);
            } else {
                terrainSample(${CLIFF}.0, pos.xy / cliffSize, dpx.xy / cliffSize, dpy.xy / cliffSize, 0.0, vec2(0.25), a, n);
            }
            ratio += terrainRatio(a, cliffMean) * blend.z * k;
            world += vec3(n.x, n.y, 0.0) * blend.z * k;
        }
    }

    void terrainRock(float weight, vec3 pos, vec3 N, vec3 dpx, vec3 dpy, float footprint, inout vec3 ratio, inout vec2 normal) {
        float size = terrainLayers[${ROCK}].w;
        float cliffSize = terrainLayers[${CLIFF}].w;
        float texel = size / 1024.0;
        float fade = 1.0 - smoothstep(texel * 8.0 * 1.5, texel * 8.0 * 12.0, footprint);
        if (fade <= 0.0) {
            ratio += weight;
            return;
        }
        vec3 blend = pow(abs(N), vec3(4.0));
        blend /= blend.x + blend.y + blend.z;
        float toMid = smoothstep(texel * 1.5, texel * 6.0, footprint);
        vec3 detail = vec3(0.0);
        vec2 nrm = vec2(0.0);
        vec3 world = vec3(0.0);
        if (toMid < 0.99) {
            terrainRockPlanes(size, cliffSize, true, pos, dpx, dpy, blend, 1.0 - toMid, detail, nrm, world);
        }
        if (toMid > 0.01) {
            terrainRockPlanes(size * 8.0, cliffSize * 8.0, false, pos, dpx, dpy, blend, toMid, detail, nrm, world);
        }
        // the scans' light slabs, well over twice as bright as their means, would turn whole faces pale
        // - their contrast is kept down, so the color of the stone shows through them
        detail = pow(max(detail, vec3(0.05)), vec3(0.6));
        ratio += weight * mix(vec3(1.0), detail, fade);
        normal += weight * fade * nrm;
        terrainRockNormal += world * weight * fade * 0.8;
    }

    void getAlbedo() {
        terrainRockNormal = vec3(0.0);
        vec3 pos = vPositionW;
        vec2 p = pos.xz;
        vec3 N = normalize(dVertexNormalW);
        float slope = 1.0 - N.y;

        // how large a pixel is on the ground, used to fade out detail that would only shimmer
        vec2 dpx = dFdx(p);
        vec2 dpy = dFdy(p);
        float footprint = length(abs(dpx) + abs(dpy));

        // the noise that varies the landscape, at three scales
        vec4 macro = terrainNoise(p, 4100.0);
        vec4 broad = terrainNoise(p, 830.0);
        vec4 medium = terrainNoise(p, 131.0);

        // meadows, from lush green to sun bleached
        float dryness = smoothstep(0.35, 0.72, macro.r * 0.65 + broad.g * 0.35);
        vec3 grass = mix(vec3(0.075, 0.13, 0.035), vec3(0.24, 0.22, 0.09), dryness);
        grass *= 0.86 + medium.b * 0.28;

        // patchwork fields on the flat lowland - a voronoi pattern of crops, with darker hedgerows
        vec2 cellSpace = p / 240.0;
        vec2 cellBase = floor(cellSpace);
        vec2 cellFrac = fract(cellSpace);
        float nearest = 8.0;
        float second = 8.0;
        vec2 nearestId = vec2(0.0);
        for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
                vec2 cell = vec2(float(i), float(j));
                vec2 offset = cell + terrainHash2(cellBase + cell) * 0.85 - cellFrac;
                float d = dot(offset, offset);
                if (d < nearest) {
                    second = nearest;
                    nearest = d;
                    nearestId = cellBase + cell;
                } else if (d < second) {
                    second = d;
                }
            }
        }
        float border = (sqrt(second) - sqrt(nearest)) * 240.0;
        float crop = terrainHash(nearestId);
        vec3 field = crop < 0.25 ? vec3(0.33, 0.27, 0.09) :
                     crop < 0.45 ? vec3(0.13, 0.19, 0.05) :
                     crop < 0.62 ? vec3(0.2, 0.15, 0.08) :
                     crop < 0.8 ? vec3(0.17, 0.22, 0.07) :
                     vec3(0.26, 0.24, 0.1);
        field *= 0.82 + 0.36 * terrainHash(nearestId + 5.0);

        // plow lines running across each field in its own direction, and half the fields mown or
        // harvested in broad strips
        float angle = terrainHash(nearestId + 17.0) * 3.1416;
        float across = dot(p, vec2(cos(angle), sin(angle)));
        float furrow = sin(across * 0.9);
        field *= 1.0 + furrow * 0.06 * (1.0 - smoothstep(0.5, 2.0, footprint));
        float strips = step(0.5, terrainHash(nearestId + 23.0)) * (1.0 - smoothstep(2.0, 6.0, footprint));
        field *= 1.0 + strips * 0.08 * (smoothstep(-0.3, 0.3, sin(across * 0.35)) * 2.0 - 1.0);

        float hedge = 1.0 - smoothstep(3.0, 6.0 + footprint * 1.5, border);
        field = mix(field, vec3(0.04, 0.07, 0.025), hedge * 0.85);

        float farmland = smoothstep(0.42, 0.52, macro.g) * (1.0 - smoothstep(0.03, 0.08, slope)) *
                         (1.0 - smoothstep(180.0, 320.0, pos.y)) * smoothstep(4.0, 10.0, pos.y);
        vec3 color = mix(grass, field, farmland);

        // forest, dense and dark, thinning out on steep ground and up high
        float forestShape = broad.r * 0.55 + macro.b * 0.45 + (medium.r - 0.5) * 0.12;
        float forest = smoothstep(0.5, 0.56, forestShape) * (1.0 - smoothstep(0.32, 0.5, slope)) *
                       (1.0 - smoothstep(650.0, 900.0, pos.y)) * smoothstep(6.0, 14.0, pos.y) * (1.0 - farmland * 0.8);
        float canopy = medium.g;
        vec3 trees = mix(vec3(0.02, 0.045, 0.018), vec3(0.06, 0.1, 0.035), canopy);

        // up close, the crowns of the trees, with the floor of the forest in their shade between them
        float crownDetail = 1.0 - smoothstep(1.2, 3.5, footprint);
        vec2 crownNormal = vec2(0.0);
        if (crownDetail > 0.0 && forest > 0.01) {
            vec3 shade;
            float shadow;
            float crown = terrainCrowns(p, footprint, forest, shade, crownNormal, shadow);
            color *= 1.0 - (1.0 - crown) * crownDetail * min(shadow * 0.55 + forest * forest * 0.35, 0.75);
            trees *= mix(vec3(1.0), shade, crownDetail);
            forest = mix(forest, crown, crownDetail);
            crownNormal *= crownDetail;
        }
        color = mix(color, trees, forest);

        // scree - loose stone on the slopes under the faces, up on the mountains, where no trees grow
        float scree = smoothstep(0.19, 0.27, slope + (medium.b - 0.5) * 0.1) *
                      smoothstep(220.0, 380.0, pos.y + (broad.g - 0.5) * 200.0) * (1.0 - forest * 0.8);
        vec3 gravel = mix(vec3(0.09, 0.084, 0.074), vec3(0.16, 0.148, 0.125), medium.a);
        color = mix(color, gravel, scree);

        // bare rock on the steep faces
        float rock = smoothstep(0.24, 0.4, slope + (medium.g - 0.5) * 0.18);
        vec3 stoneTilt = vec3(0.0);
        if (rock > 0.002) {
            color = mix(color, terrainStone(pos, N, broad, medium, footprint, stoneTilt), rock);
        }

        // Sand along the shore, wet and darker right at the water. The band widens with the size of
        // a pixel on the ground, so a distant shoreline stays a soft band instead of a bright line too
        // thin to draw, which shimmers as the camera moves.
        float shoreHeight = pos.y + (medium.r - 0.5) * 4.0;
        float shoreWidth = 5.0 + fwidth(pos.y) * 2.0 + footprint * 0.15;
        float sand = (1.0 - smoothstep(1.0, 1.0 + shoreWidth, shoreHeight)) * (1.0 - smoothstep(0.2, 0.45, slope));
        vec3 sandColor = mix(vec3(0.16, 0.14, 0.1), vec3(0.33, 0.29, 0.2), smoothstep(0.0, 2.5, shoreHeight));
        color = mix(color, sandColor, sand);

        // the pads the enemy bases stand on
        float pads = 0.0;
        for (int i = 0; i < ${MAX_SITES}; i++) {
            vec4 site = terrainSites[i];
            float d = length(p - site.xy);
            float pad = 1.0 - smoothstep(site.z * 0.85, site.z, d);
            float ring = 1.0 - smoothstep(4.0, 7.0, abs(d - site.z * 0.6));
            color = mix(color, vec3(0.24, 0.22, 0.19), pad * site.w);
            color = mix(color, vec3(0.12, 0.11, 0.1), ring * pad * site.w * 0.7);
            pads = max(pads, pad * site.w);
        }

        // How much each of the textured layers covers here, following the same mixes as the color -
        // meadow and dry grass, then soil, the trees, the scree on soil, rock, sand and the soil of
        // the pads.
        float w[${LAYER_COUNT + 1}];
        for (int i = 0; i <= ${LAYER_COUNT}; i++) {
            w[i] = 0.0;
        }
        w[0] = 1.0 - dryness;
        w[1] = dryness;
        float layers[6] = float[6](farmland, forest, scree, rock, sand, pads);
        int targets[6] = int[6](${SOIL}, ${TREES}, ${SOIL}, ${ROCK}, ${SAND}, ${SOIL});
        for (int k = 0; k < 6; k++) {
            for (int i = 0; i <= ${LAYER_COUNT}; i++) {
                w[i] *= 1.0 - layers[k];
            }
            w[targets[k]] += layers[k];
        }

        // the detail of the layers that cover enough of this pixel to show
        vec3 ratio = vec3(0.0);
        vec2 normal = vec2(0.0);
        float total = 0.0;
        for (int i = 0; i < ${LAYER_COUNT}; i++) {
            if (w[i] > 0.03 && i != ${ROCK}) {
                // every field has its soil turned its own way
                float turn = i == ${SOIL} ? angle : 0.0;
                terrainLayer(i, w[i], p, dpx, dpy, footprint, turn, ratio, normal);
                total += w[i];
            }
        }
        if (w[${ROCK}] > 0.03) {
            terrainRock(w[${ROCK}], pos, N, dFdx(pos), dFdy(pos), footprint, ratio, normal);
            total += w[${ROCK}];
        }
        if (w[${TREES}] > 0.03) {
            ratio += w[${TREES}];
            normal += w[${TREES}] * crownNormal;
            total += w[${TREES}];
        }
        ratio = total > 0.0 ? ratio / total : vec3(1.0);
        terrainDetailNormal = total > 0.0 ? normal / total : vec2(0.0);
        terrainRockNormal += stoneTilt * w[${ROCK}];

        dAlbedo = color * clamp(ratio, vec3(0.2), vec3(3.0));
    }
`;

const terrainNormalGLSL = /* glsl */ `
    void getNormal() {
        // the normal maps of the layers, bent around the slope of the ground
        vec3 N = normalize(dVertexNormalW);
        vec3 T = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
        vec3 B = normalize(vec3(0.0, 0.0, 1.0) - N * N.z);
        dNormalW = normalize(N + (T * terrainDetailNormal.x - B * terrainDetailNormal.y) * 0.9 + terrainRockNormal);
    }
`;

const terrainWGSL = /* wgsl */ `
    var terrainNoiseMap: texture_2d<f32>;
    var terrainNoiseMapSampler: sampler;
    var terrainAlbedoMaps: texture_2d_array<f32>;
    var terrainAlbedoMapsSampler: sampler;
    var terrainNormalMaps: texture_2d_array<f32>;
    var terrainNormalMapsSampler: sampler;
    uniform terrainSites: array<vec4f, ${MAX_SITES}>;

    // per layer - the mean albedo of its texture, and the size of one tile of it, in meters
    uniform terrainLayers: array<vec4f, ${LAYER_COUNT}>;

    // the normal maps of the layers, blended in getAlbedo for getNormal - x and z on the ground
    var<private> terrainDetailNormal: vec2f;

    // the bend of the normal of the rock - from the cliff scan's normal map on the upright faces, and
    // the relief of the gullies - in the world, as the faces' own tangents do not line up with x and z
    var<private> terrainRockNormal: vec3f;

    fn terrainHash(p: vec2f) -> f32 {
        return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
    }

    fn terrainHash2(p: vec2f) -> vec2f {
        return fract(sin(vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)))) * 43758.5453);
    }

    fn terrainRotate(v: vec2f, a: f32) -> vec2f {
        let c = cos(a);
        let s = sin(a);
        return vec2f(v.x * c - v.y * s, v.x * s + v.y * c);
    }

    // How a layer's texture differs from its mean - its brightness in full, and its tint only in part,
    // measured with a floor, so a channel that is nearly black on average (the blue of grass) does not
    // turn a few bright texels into sparkles.
    fn terrainRatio(albedo: vec3f, mean: vec3f) -> vec3f {
        let luma = vec3f(0.2126, 0.7152, 0.0722);
        let a = dot(albedo, luma);
        let m = dot(mean, luma);
        let tint = ((albedo + 0.03) / (a + 0.03)) / ((mean + 0.03) / (m + 0.03));
        return a / m * mix(vec3f(1.0), clamp(tint, vec3f(0.6), vec3f(1.6)), vec3f(0.6));
    }

    struct TerrainSample {
        albedo: vec3f,
        normal: vec2f
    };

    // One texture sample of a layer, with its own rotation and offset, and the gradients turned to
    // match, so the mip level is right at the seams between the samples.
    fn terrainSample(layer: i32, st: vec2f, dx: vec2f, dy: vec2f, angle: f32, offset: vec2f) -> TerrainSample {
        let uv = terrainRotate(st, angle) + offset;
        let gx = terrainRotate(dx, angle);
        let gy = terrainRotate(dy, angle);
        var result: TerrainSample;
        result.albedo = textureSampleGrad(terrainAlbedoMaps, terrainAlbedoMapsSampler, uv, layer, gx, gy).rgb;
        let n = textureSampleGrad(terrainNormalMaps, terrainNormalMapsSampler, uv, layer, gx, gy).xy * 2.0 - 1.0;
        result.normal = terrainRotate(n, -angle);
        return result;
    }

    // Hex tiling - a grid of hexagons, each with its own random turn and shift of a texture, blended
    // over the triangles between their centers, so the texture never lines up into a repeating grid
    // (after Mikkelsen, Practical Real-Time Hex-Tiling, and Heitz and Neyret's triangle grid) - the
    // weights of the three hexagons around a point, and where they are in the grid.
    struct TerrainHex {
        w: vec3f,
        v1: vec2f,
        v2: vec2f,
        v3: vec2f
    };

    fn terrainHexGrid(st: vec2f) -> TerrainHex {
        let grid = st * 3.4641016;
        let skewed = vec2f(grid.x, grid.y * 1.15470054 - grid.x * 0.57735027);
        let base = floor(skewed);
        let fr = fract(skewed);
        let fz = 1.0 - fr.x - fr.y;
        var hex: TerrainHex;
        if (fz > 0.0) {
            hex.w = vec3f(fz, fr.y, fr.x);
            hex.v1 = base; hex.v2 = base + vec2f(0.0, 1.0); hex.v3 = base + vec2f(1.0, 0.0);
        } else {
            hex.w = vec3f(-fz, 1.0 - fr.y, 1.0 - fr.x);
            hex.v1 = base + vec2f(1.0); hex.v2 = base + vec2f(1.0, 0.0); hex.v3 = base + vec2f(0.0, 1.0);
        }
        return hex;
    }

    // a layer's texture, hex tiled
    fn terrainHexSample(layer: i32, st: vec2f, dx: vec2f, dy: vec2f) -> TerrainSample {
        let hex = terrainHexGrid(st);
        var w = pow(hex.w, vec3f(6.0));
        w = w / (w.x + w.y + w.z);

        let fl = f32(layer);
        let s1 = terrainSample(layer, st, dx, dy, terrainHash(hex.v1 + fl) * 6.2832, terrainHash2(hex.v1 * 1.7 + fl));
        let s2 = terrainSample(layer, st, dx, dy, terrainHash(hex.v2 + fl) * 6.2832, terrainHash2(hex.v2 * 1.7 + fl));
        let s3 = terrainSample(layer, st, dx, dy, terrainHash(hex.v3 + fl) * 6.2832, terrainHash2(hex.v3 * 1.7 + fl));
        var result: TerrainSample;
        result.albedo = s1.albedo * w.x + s2.albedo * w.y + s3.albedo * w.z;
        result.normal = s1.normal * w.x + s2.normal * w.y + s3.normal * w.z;
        return result;
    }

    // The noise map at a scale, as the sum of two copies of it, turned apart and a little larger and
    // smaller than the scale - their periods share no common multiple, so the sum never repeats in a
    // grid. The sum is stretched back out to the spread of a single sample.
    fn terrainNoise(p: vec2f, scale: f32) -> vec4f {
        let a = mat2x2f(0.8776, 0.4794, -0.4794, 0.8776) * p / (scale * 0.79);
        let b = mat2x2f(-0.5048, 0.8632, -0.8632, -0.5048) * p / (scale * 1.27) + 0.37;
        let n = textureSample(terrainNoiseMap, terrainNoiseMapSampler, a) + textureSample(terrainNoiseMap, terrainNoiseMapSampler, b);
        return clamp((n - 1.0) * 0.7071 + 0.5, vec4f(0.0), vec4f(1.0));
    }

    // terrainNoise at the mip level of a pixel's footprint on the ground, so it can be sampled in a
    // branch, where the derivatives the plain one relies on are not defined
    fn terrainNoiseLod(p: vec2f, scale: f32, footprint: f32) -> vec4f {
        let sa = scale * 0.79;
        let sb = scale * 1.27;
        let a = mat2x2f(0.8776, 0.4794, -0.4794, 0.8776) * p / sa;
        let b = mat2x2f(-0.5048, 0.8632, -0.8632, -0.5048) * p / sb + 0.37;
        let n = textureSampleLevel(terrainNoiseMap, terrainNoiseMapSampler, a, log2(max(footprint * 256.0 / sa, 1.0))) +
                textureSampleLevel(terrainNoiseMap, terrainNoiseMapSampler, b, log2(max(footprint * 256.0 / sb, 1.0)));
        return clamp((n - 1.0) * 0.7071 + 0.5, vec4f(0.0), vec4f(1.0));
    }

    // noise stretched upright on the two upright planes, mixed by which one a face looks along - the
    // gullies and the streaks the water leaves running down the faces of the rock
    fn terrainStreaks(pos: vec3f, N: vec3f, scale: f32, footprint: f32) -> f32 {
        var w = abs(N.xz) + vec2f(0.001);
        w = w / (w.x + w.y);
        let alongX = terrainNoiseLod(vec2f(pos.z, pos.y * 0.2), scale, footprint).r;
        let alongZ = terrainNoiseLod(vec2f(pos.x, pos.y * 0.2), scale, footprint).r;
        return alongX * w.x + alongZ * w.y;
    }

    struct TerrainStone {
        color: vec3f,
        tilt: vec3f
    }

    // Bare rock - in broad bands of darker and lighter gray along its strata, which tilt and waver, with
    // patches of buff and of ochre staining, streaked dark down the faces by gullies, and with a little
    // lichen where it is not too steep. The gullies also bend the normal across the face - a relief the coarse
    // grid of the terrain is far too smooth to have - returned in tilt, in the world.
    fn terrainStone(pos: vec3f, N: vec3f, broad: vec4f, medium: vec4f, footprint: f32) -> TerrainStone {
        let level = pos.y + (broad.r - 0.5) * 160.0;
        let bands = terrainNoiseLod(vec2f(level, 17.3), 70.0, footprint).b;
        var stone = mix(vec3f(0.065, 0.062, 0.058), vec3f(0.13, 0.122, 0.108), vec3f(bands));
        stone = mix(stone, vec3f(0.18, 0.168, 0.145), vec3f(smoothstep(0.58, 0.8, broad.b) * 0.7));
        stone = mix(stone, vec3f(0.16, 0.115, 0.07), vec3f(smoothstep(0.62, 0.8, medium.r) * 0.35));

        // the dark streaks down the faces, and the broad gullies they run in
        let streak = terrainStreaks(pos, N, 45.0, footprint);
        stone = stone * (1.0 - smoothstep(0.52, 0.72, streak) * 0.25);
        let across = normalize(vec3f(-N.z, 0.0, N.x) + vec3f(1e-4, 0.0, 0.0));
        let gully = terrainStreaks(pos, N, 80.0, footprint);
        let next = terrainStreaks(pos + across * 6.0, N, 80.0, footprint);

        let lichen = smoothstep(0.55, 0.75, medium.a) * (1.0 - smoothstep(0.3, 0.55, 1.0 - N.y));
        var result: TerrainStone;
        result.color = mix(stone, vec3f(0.075, 0.085, 0.045), vec3f(lichen * 0.45));
        result.tilt = -across * clamp((next - gully) * 3.0, -0.3, 0.3);
        return result;
    }

    // four values in 0..1 for a cell, from multiplies alone, without the cost of a sine (after Dave
    // Hoskins, Hash without Sine) - the crowns hash every cell around a pixel
    fn terrainHash4(p: vec2f) -> vec4f {
        var p4 = fract(p.xyxy * vec4f(0.1031, 0.103, 0.0973, 0.1099));
        p4 = p4 + dot(p4, p4.wzxy + 33.33);
        return fract((p4.xxyz + p4.yzzw) * p4.zywx);
    }

    // The highest tree crown over a point, in a jittered grid of crowns seven meters apart, of varied
    // size and ragged outline, with fewer of them where the forest thins out - the crown's height
    // squared, which is zero where no crown covers the point, and its offset from the point, radius
    // and id.
    struct TerrainCrownTop {
        top: f32,
        offset: vec2f,
        radius: f32,
        id: vec2f
    };

    fn terrainCrownTop(cs: vec2f, density: f32) -> TerrainCrownTop {
        let base = floor(cs);
        let f = fract(cs);
        var top = 0.0;
        var offset = vec2f(0.0);
        var radius = 1.0;
        var id = vec2f(0.0);
        for (var j: i32 = -1; j <= 1; j = j + 1) {
            for (var i: i32 = -1; i <= 1; i = i + 1) {
                let cell = base + vec2f(f32(i), f32(j));
                let hash = terrainHash4(cell);
                if (hash.w < density * 1.4 - 0.3) {
                    let o = f - vec2f(f32(i), f32(j)) - 0.15 - hash.xy * 0.7;
                    // A ragged outline of five and three lobes - Chebyshev polynomials of the direction
                    // give the cosines of its multiples without an angle, and swapping and mirroring
                    // the direction turns the lobes from crown to crown.
                    var dir = o * inverseSqrt(dot(o, o) + 0.000001);
                    dir = select(dir.yx, dir, hash.z > 0.5);
                    let c = select(-dir.x, dir.x, fract(hash.z * 7.0) > 0.5);
                    let lobes = c * (16.0 * c * c * c * c - 20.0 * c * c + 5.0) * 0.1 + dir.y * (4.0 * dir.y * dir.y - 3.0) * 0.06;
                    let r = (0.42 + 0.3 * fract(hash.z * 13.0)) * (1.0 + lobes);
                    // the highest crown over the point - a dome's height squared is r^2 - d^2
                    let height = r * r - dot(o, o);
                    if (height > top) {
                        top = height;
                        offset = o;
                        radius = r;
                        id = cell;
                    }
                }
            }
        }
        return TerrainCrownTop(top, offset, radius, id);
    }

    // Tree crowns, each a cluster of smaller clumps of leaves. The crowns are domes that bend the
    // normal, so the sun lights one side of each and leaves the other in shade, and they cast their
    // shadows on the ground between them, which is most of what makes a forest read from the air.
    // Returns how much of the point is under a crown, with the crown's albedo relative to the forest's
    // color and its normal, and how much of the ground there is in the shadow of the trees. The sun's
    // direction comes from the atmosphere's chunks.
    struct TerrainCrown {
        cover: f32,
        shade: vec3f,
        normal: vec2f,
        shadow: f32
    };

    fn terrainCrowns(p: vec2f, footprint: f32, density: f32) -> TerrainCrown {
        // the edges of the crowns and of their shadows are softened over a pixel
        let soft = 2.0 * footprint / 7.0 + 0.0001;
        var crown: TerrainCrown;
        crown.cover = 0.0;
        crown.shade = vec3f(1.0);
        crown.normal = vec2f(0.0);
        crown.shadow = 0.0;

        // the shadow, from crowns about fifteen meters up
        // the sun's direction in the world - the sky's own is mirrored on x
        let sun = vec3f(-uniform.dynSkySunDir.x, uniform.dynSkySunDir.y, uniform.dynSkySunDir.z);
        if (sun.y > 0.02) {
            let reach = sun.xz / max(sun.y, 0.3) * 15.0;
            let caster = terrainCrownTop((p + reach) / 7.0, density);
            crown.shadow = clamp(caster.top / (caster.radius * soft), 0.0, 1.0) * smoothstep(0.02, 0.15, sun.y);
        }

        let hit = terrainCrownTop(p / 7.0, density);
        let top = hit.top;
        let offset = hit.offset;
        let radius = hit.radius;
        let id = hit.id;
        if (top <= 0.0) {
            return crown;
        }
        let h = sqrt(top);
        let hash = terrainHash4(id + 0.5);
        var shade = vec3f(0.7 + 0.6 * hash.x);
        // a few broadleaf trees lighter and yellower, a few conifers darker and bluer
        let kind = hash.y;
        if (kind > 0.85) {
            shade = shade * vec3f(1.2, 1.1, 0.75);
        } else if (kind < 0.2) {
            shade = shade * vec3f(0.8, 0.9, 1.0);
        }
        shade = shade * (0.65 + 0.35 * h / radius);
        var normal = vec2f(offset.x, -offset.y) / max(h, 0.35 * radius) * 0.5;

        // the clumps of leaves, close up
        let clumps = 1.0 - smoothstep(0.25, 0.9, footprint);
        if (clumps > 0.0) {
            let cq = p / 2.2 + id * 3.7;
            let cb = floor(cq);
            let cf = fract(cq);
            var near = 8.0;
            var next = 8.0;
            var co = vec2f(0.0);
            for (var j: i32 = -1; j <= 1; j = j + 1) {
                for (var i: i32 = -1; i <= 1; i = i + 1) {
                    let o = cf - vec2f(f32(i), f32(j)) - terrainHash4(cb + vec2f(f32(i), f32(j))).xy;
                    let d = dot(o, o);
                    if (d < near) {
                        next = near;
                        near = d;
                        co = o;
                    } else if (d < next) {
                        next = d;
                    }
                }
            }
            // each clump a soft bump, its tilt gone by the border with the next, so there is no crease
            let edge = smoothstep(0.0, 0.2, sqrt(next) - sqrt(near));
            shade = shade * mix(1.0, 0.82 + 0.3 * (1.0 - min(near * 2.0, 1.0)), clumps);
            normal = normal + vec2f(co.x, -co.y) * 0.45 * edge * clumps;
        }

        // the mean of the shades is about 0.88
        crown.shade = shade / 0.88;
        crown.normal = normal;
        crown.cover = clamp(top / (radius * soft), 0.0, 1.0);
        return crown;
    }

    // A layer's detail at a point, at whichever of three scales of its texture is resolved at this
    // distance - its own size near the ground, eight times larger hex tiled from a few hundred meters,
    // and sixty four times larger, in two turned copies, further out - so there is detail at any
    // altitude, and the texture never repeats in a grid. Returns the albedo relative to the layer's
    // mean, so it varies the color of the landscape rather than replacing it.
    fn terrainLayer(index: i32, weight: f32, p: vec2f, dpx: vec2f, dpy: vec2f, footprint: f32, turn: f32) -> TerrainSample {
        let info = uniform.terrainLayers[index];
        let size = info.w;
        let texel = size / 1024.0;
        let fade = 1.0 - smoothstep(texel * 64.0 * 1.5, texel * 64.0 * 10.0, footprint);
        var result: TerrainSample;
        if (fade <= 0.0) {
            result.albedo = vec3f(weight);
            result.normal = vec2f(0.0);
            return result;
        }
        let fl = f32(index);
        let q = terrainRotate(p, turn);
        let qx = terrainRotate(dpx, turn);
        let qy = terrainRotate(dpy, turn);
        let toMid = smoothstep(texel * 1.5, texel * 6.0, footprint);
        let toFar = smoothstep(texel * 12.0, texel * 48.0, footprint);

        var albedo = vec3f(0.0);
        var nrm = vec2f(0.0);
        if (toMid < 0.99) {
            let s0 = terrainSample(index, q / size, qx / size, qy / size, 0.37 + fl, vec2f(0.0));
            albedo = albedo + s0.albedo * (1.0 - toMid);
            nrm = nrm + s0.normal * (1.0 - toMid);
        }
        if (toMid > 0.01 && toFar < 0.99) {
            let mid = size * 8.0;
            let s1 = terrainHexSample(index, q / mid, qx / mid, qy / mid);
            let k = toMid * (1.0 - toFar);
            albedo = albedo + s1.albedo * k;
            nrm = nrm + s1.normal * 0.6 * k;
        }
        if (toFar > 0.01) {
            let far = size * 64.0;
            let s2 = terrainSample(index, q / far, qx / far, qy / far, 0.61 + fl, vec2f(0.37, 0.71) * fl);
            let s3 = terrainSample(index, q / (far * 1.37), qx / (far * 1.37), qy / (far * 1.37), 2.3 + fl, vec2f(0.13, 0.52));
            albedo = albedo + (s2.albedo + s3.albedo) * 0.5 * toMid * toFar;
            nrm = nrm + (s2.normal + s3.normal) * 0.2 * toMid * toFar;
        }
        result.albedo = weight * mix(vec3f(1.0), terrainRatio(albedo, info.rgb), vec3f(fade));
        result.normal = weight * fade * terrainRotate(nrm, -turn);
        return result;
    }

    struct TerrainRock {
        ratio: vec3f,
        normal: vec2f,
        world: vec3f
    }

    // one sample of a rock scan, hex tiled close up and plain further away
    fn terrainRockSample(layer: i32, hex: bool, st: vec2f, dx: vec2f, dy: vec2f, offset: vec2f) -> TerrainSample {
        if (hex) {
            return terrainHexSample(layer, st + offset, dx, dy);
        }
        return terrainSample(layer, st, dx, dy, 0.0, offset);
    }

    // Rock, projected from three sides, so it does not stretch down the cliffs - the aerial scan from
    // above, and the scan of a cliff face on the two upright sides, its normal map bending the normal
    // in the world. Each is measured against its own mean. Hex tiled close up, so neither repeats.
    fn terrainRockPlanes(rockSize: f32, cliffSize: f32, hex: bool, pos: vec3f, dpx: vec3f, dpy: vec3f, blend: vec3f, k: f32) -> TerrainRock {
        let rockMean = uniform.terrainLayers[${ROCK}].rgb;
        let cliffMean = uniform.terrainLayers[${CLIFF}].rgb;
        var result: TerrainRock;
        result.ratio = vec3f(0.0);
        result.normal = vec2f(0.0);
        result.world = vec3f(0.0);
        if (blend.y > 0.02) {
            var top: TerrainSample;
            if (hex) {
                top = terrainHexSample(${ROCK}, pos.xz / rockSize, dpx.xz / rockSize, dpy.xz / rockSize);
            } else {
                top = terrainSample(${ROCK}, pos.xz / rockSize, dpx.xz / rockSize, dpy.xz / rockSize, 0.3, vec2f(0.0));
            }
            result.ratio = result.ratio + terrainRatio(top.albedo, rockMean) * blend.y * k;
            result.normal = top.normal * blend.y * k;
        }
        if (blend.x > 0.02) {
            let side = terrainRockSample(${CLIFF}, hex, pos.zy / cliffSize, dpx.zy / cliffSize, dpy.zy / cliffSize, vec2f(0.5));
            result.ratio = result.ratio + terrainRatio(side.albedo, cliffMean) * blend.x * k;
            result.world = result.world + vec3f(0.0, side.normal.y, side.normal.x) * blend.x * k;
        }
        if (blend.z > 0.02) {
            let side = terrainRockSample(${CLIFF}, hex, pos.xy / cliffSize, dpx.xy / cliffSize, dpy.xy / cliffSize, vec2f(0.25));
            result.ratio = result.ratio + terrainRatio(side.albedo, cliffMean) * blend.z * k;
            result.world = result.world + vec3f(side.normal.x, side.normal.y, 0.0) * blend.z * k;
        }
        return result;
    }

    fn terrainRock(weight: f32, pos: vec3f, N: vec3f, dpx: vec3f, dpy: vec3f, footprint: f32) -> TerrainSample {
        let size = uniform.terrainLayers[${ROCK}].w;
        let cliffSize = uniform.terrainLayers[${CLIFF}].w;
        let texel = size / 1024.0;
        let fade = 1.0 - smoothstep(texel * 8.0 * 1.5, texel * 8.0 * 12.0, footprint);
        var result: TerrainSample;
        if (fade <= 0.0) {
            result.albedo = vec3f(weight);
            result.normal = vec2f(0.0);
            return result;
        }
        var blend = pow(abs(N), vec3f(4.0));
        blend = blend / (blend.x + blend.y + blend.z);
        let toMid = smoothstep(texel * 1.5, texel * 6.0, footprint);
        var detail = vec3f(0.0);
        var nrm = vec2f(0.0);
        var world = vec3f(0.0);
        if (toMid < 0.99) {
            let near = terrainRockPlanes(size, cliffSize, true, pos, dpx, dpy, blend, 1.0 - toMid);
            detail = detail + near.ratio;
            nrm = nrm + near.normal;
            world = world + near.world;
        }
        if (toMid > 0.01) {
            let far = terrainRockPlanes(size * 8.0, cliffSize * 8.0, false, pos, dpx, dpy, blend, toMid);
            detail = detail + far.ratio;
            nrm = nrm + far.normal;
            world = world + far.world;
        }
        // the scans' light slabs, well over twice as bright as their means, would turn whole faces pale
        // - their contrast is kept down, so the color of the stone shows through them
        detail = pow(max(detail, vec3f(0.05)), vec3f(0.6));
        result.albedo = weight * mix(vec3f(1.0), detail, vec3f(fade));
        result.normal = weight * fade * nrm;
        terrainRockNormal = terrainRockNormal + world * weight * fade * 0.8;
        return result;
    }
    fn getAlbedo() {
        let pos = vPositionW;
        let p = pos.xz;
        let N = normalize(dVertexNormalW);
        let slope = 1.0 - N.y;

        // how large a pixel is on the ground, used to fade out detail that would only shimmer
        let dpx = dpdx(p);
        let dpy = dpdy(p);
        let footprint = length(abs(dpx) + abs(dpy));
        let dposx = dpdx(pos);
        let dposy = dpdy(pos);

        // the noise that varies the landscape, at three scales
        let macro_ = terrainNoise(p, 4100.0);
        let broad = terrainNoise(p, 830.0);
        let medium = terrainNoise(p, 131.0);

        // meadows, from lush green to sun bleached
        let dryness = smoothstep(0.35, 0.72, macro_.r * 0.65 + broad.g * 0.35);
        var grass = mix(vec3f(0.075, 0.13, 0.035), vec3f(0.24, 0.22, 0.09), vec3f(dryness));
        grass = grass * (0.86 + medium.b * 0.28);

        // patchwork fields on the flat lowland - a voronoi pattern of crops, with darker hedgerows
        let cellSpace = p / 240.0;
        let cellBase = floor(cellSpace);
        let cellFrac = fract(cellSpace);
        var nearest = 8.0;
        var second = 8.0;
        var nearestId = vec2f(0.0);
        for (var j: i32 = -1; j <= 1; j = j + 1) {
            for (var i: i32 = -1; i <= 1; i = i + 1) {
                let cell = vec2f(f32(i), f32(j));
                let offset = cell + terrainHash2(cellBase + cell) * 0.85 - cellFrac;
                let d = dot(offset, offset);
                if (d < nearest) {
                    second = nearest;
                    nearest = d;
                    nearestId = cellBase + cell;
                } else if (d < second) {
                    second = d;
                }
            }
        }
        let border = (sqrt(second) - sqrt(nearest)) * 240.0;
        let crop = terrainHash(nearestId);
        var field = vec3f(0.26, 0.24, 0.1);
        if (crop < 0.25) {
            field = vec3f(0.33, 0.27, 0.09);
        } else if (crop < 0.45) {
            field = vec3f(0.13, 0.19, 0.05);
        } else if (crop < 0.62) {
            field = vec3f(0.2, 0.15, 0.08);
        } else if (crop < 0.8) {
            field = vec3f(0.17, 0.22, 0.07);
        }
        field = field * (0.82 + 0.36 * terrainHash(nearestId + 5.0));

        // plow lines running across each field in its own direction, and half the fields mown or
        // harvested in broad strips
        let angle = terrainHash(nearestId + 17.0) * 3.1416;
        let across = dot(p, vec2f(cos(angle), sin(angle)));
        let furrow = sin(across * 0.9);
        field = field * (1.0 + furrow * 0.06 * (1.0 - smoothstep(0.5, 2.0, footprint)));
        let strips = step(0.5, terrainHash(nearestId + 23.0)) * (1.0 - smoothstep(2.0, 6.0, footprint));
        field = field * (1.0 + strips * 0.08 * (smoothstep(-0.3, 0.3, sin(across * 0.35)) * 2.0 - 1.0));

        let hedge = 1.0 - smoothstep(3.0, 6.0 + footprint * 1.5, border);
        field = mix(field, vec3f(0.04, 0.07, 0.025), vec3f(hedge * 0.85));

        let farmland = smoothstep(0.42, 0.52, macro_.g) * (1.0 - smoothstep(0.03, 0.08, slope)) *
                       (1.0 - smoothstep(180.0, 320.0, pos.y)) * smoothstep(4.0, 10.0, pos.y);
        var color = mix(grass, field, vec3f(farmland));

        // forest, dense and dark, thinning out on steep ground and up high
        let forestShape = broad.r * 0.55 + macro_.b * 0.45 + (medium.r - 0.5) * 0.12;
        var forest = smoothstep(0.5, 0.56, forestShape) * (1.0 - smoothstep(0.32, 0.5, slope)) *
                     (1.0 - smoothstep(650.0, 900.0, pos.y)) * smoothstep(6.0, 14.0, pos.y) * (1.0 - farmland * 0.8);
        let canopy = medium.g;
        var trees = mix(vec3f(0.02, 0.045, 0.018), vec3f(0.06, 0.1, 0.035), vec3f(canopy));

        // up close, the crowns of the trees, with the floor of the forest in their shade between them
        let crownDetail = 1.0 - smoothstep(1.2, 3.5, footprint);
        var crownNormal = vec2f(0.0);
        if (crownDetail > 0.0 && forest > 0.01) {
            let crown = terrainCrowns(p, footprint, forest);
            color = color * (1.0 - (1.0 - crown.cover) * crownDetail * min(crown.shadow * 0.55 + forest * forest * 0.35, 0.75));
            trees = trees * mix(vec3f(1.0), crown.shade, vec3f(crownDetail));
            forest = mix(forest, crown.cover, crownDetail);
            crownNormal = crown.normal * crownDetail;
        }
        color = mix(color, trees, vec3f(forest));

        // scree - loose stone on the slopes under the faces, up on the mountains, where no trees grow
        let scree = smoothstep(0.19, 0.27, slope + (medium.b - 0.5) * 0.1) *
                    smoothstep(220.0, 380.0, pos.y + (broad.g - 0.5) * 200.0) * (1.0 - forest * 0.8);
        let gravel = mix(vec3f(0.09, 0.084, 0.074), vec3f(0.16, 0.148, 0.125), vec3f(medium.a));
        color = mix(color, gravel, vec3f(scree));

        // bare rock on the steep faces
        let rock = smoothstep(0.24, 0.4, slope + (medium.g - 0.5) * 0.18);
        var stoneTilt = vec3f(0.0);
        if (rock > 0.002) {
            let stone = terrainStone(pos, N, broad, medium, footprint);
            color = mix(color, stone.color, vec3f(rock));
            stoneTilt = stone.tilt;
        }

        // Sand along the shore, wet and darker right at the water. The band widens with the size of
        // a pixel on the ground, so a distant shoreline stays a soft band instead of a bright line too
        // thin to draw, which shimmers as the camera moves.
        let shoreHeight = pos.y + (medium.r - 0.5) * 4.0;
        let shoreWidth = 5.0 + fwidth(pos.y) * 2.0 + footprint * 0.15;
        let sand = (1.0 - smoothstep(1.0, 1.0 + shoreWidth, shoreHeight)) * (1.0 - smoothstep(0.2, 0.45, slope));
        let sandColor = mix(vec3f(0.16, 0.14, 0.1), vec3f(0.33, 0.29, 0.2), vec3f(smoothstep(0.0, 2.5, shoreHeight)));
        color = mix(color, sandColor, vec3f(sand));

        // the pads the enemy bases stand on
        var pads = 0.0;
        for (var s: i32 = 0; s < ${MAX_SITES}; s = s + 1) {
            let site = uniform.terrainSites[s];
            let d = length(p - site.xy);
            let pad = 1.0 - smoothstep(site.z * 0.85, site.z, d);
            let ring = 1.0 - smoothstep(4.0, 7.0, abs(d - site.z * 0.6));
            color = mix(color, vec3f(0.24, 0.22, 0.19), vec3f(pad * site.w));
            color = mix(color, vec3f(0.12, 0.11, 0.1), vec3f(ring * pad * site.w * 0.7));
            pads = max(pads, pad * site.w);
        }

        // How much each of the textured layers covers here, following the same mixes as the color -
        // meadow and dry grass, then soil, the trees, the scree on soil, rock, sand and the soil of
        // the pads.
        var w: array<f32, ${LAYER_COUNT + 1}>;
        w[0] = 1.0 - dryness;
        w[1] = dryness;
        var layers = array<f32, 6>(farmland, forest, scree, rock, sand, pads);
        var targets = array<i32, 6>(${SOIL}, ${TREES}, ${SOIL}, ${ROCK}, ${SAND}, ${SOIL});
        for (var k: i32 = 0; k < 6; k = k + 1) {
            for (var i: i32 = 0; i <= ${LAYER_COUNT}; i = i + 1) {
                w[i] = w[i] * (1.0 - layers[k]);
            }
            w[targets[k]] = w[targets[k]] + layers[k];
        }

        // the detail of the layers that cover enough of this pixel to show
        var ratio = vec3f(0.0);
        var normal = vec2f(0.0);
        var total = 0.0;
        for (var i: i32 = 0; i < ${LAYER_COUNT}; i = i + 1) {
            if (w[i] > 0.03 && i != ${ROCK}) {
                // every field has its soil turned its own way
                let turn = select(0.0, angle, i == ${SOIL});
                let detail = terrainLayer(i, w[i], p, dpx, dpy, footprint, turn);
                ratio = ratio + detail.albedo;
                normal = normal + detail.normal;
                total = total + w[i];
            }
        }
        if (w[${ROCK}] > 0.03) {
            let detail = terrainRock(w[${ROCK}], pos, N, dposx, dposy, footprint);
            ratio = ratio + detail.albedo;
            normal = normal + detail.normal;
            total = total + w[${ROCK}];
        }
        if (w[${TREES}] > 0.03) {
            ratio = ratio + vec3f(w[${TREES}]);
            normal = normal + w[${TREES}] * crownNormal;
            total = total + w[${TREES}];
        }
        if (total > 0.0) {
            ratio = ratio / total;
            terrainDetailNormal = normal / total;
        } else {
            ratio = vec3f(1.0);
            terrainDetailNormal = vec2f(0.0);
        }
        terrainRockNormal = terrainRockNormal + stoneTilt * w[${ROCK}];

        dAlbedo = color * clamp(ratio, vec3f(0.2), vec3f(3.0));
    }
`;

const terrainNormalWGSL = /* wgsl */ `
    fn getNormal() {
        // the normal maps of the layers, bent around the slope of the ground
        let N = normalize(dVertexNormalW);
        let T = normalize(vec3f(1.0, 0.0, 0.0) - N * N.x);
        let B = normalize(vec3f(0.0, 0.0, 1.0) - N * N.z);
        dNormalW = normalize(N + (T * terrainDetailNormal.x - B * terrainDetailNormal.y) * 0.9 + terrainRockNormal);
    }
`;

/**
 * Generates a tileable noise texture with four independent channels, which the terrain shader
 * samples at several scales to vary the surface.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {number} seed - The seed.
 * @returns {Texture} The texture.
 */
const createNoiseTexture = (device, seed) => {
    const size = 256;
    const pixels = new Uint8Array(size * size * 4);
    const noises = [0, 1, 2, 3].map((c) => createNoise(seed * 7 + c * 131 + 5));

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const o = (y * size + x) * 4;
            for (let c = 0; c < 4; c++) {
                let sum = 0;
                let amplitude = 0.5;
                let period = 4;
                for (let octave = 0; octave < 5; octave++) {
                    // every octave repeats a whole number of times across the texture, so it tiles
                    sum += noises[c]((x / size) * period, (y / size) * period, period) * amplitude;
                    amplitude *= 0.5;
                    period *= 2;
                }
                pixels[o + c] = math.clamp(Math.round((sum * 0.75 + 0.5) * 255), 0, 255);
            }
        }
    }

    const texture = new Texture(device, {
        name: 'TerrainNoise',
        width: size,
        height: size,
        format: PIXELFORMAT_RGBA8,
        mipmaps: true,
        minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        anisotropy: 8,
        levels: [pixels]
    });
    texture.upload();
    return texture;
};

/**
 * Generates a tileable texture of wind driven waves - the sum of a few dozen trains of waves of many
 * lengths, all running roughly downwind, along x, their crests sharpened and their troughs flattened
 * as on real water. Every wave fits a whole number of times across the texture, so it tiles.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {number} seed - The seed.
 * @returns {Texture} The waves, with the slope across x and y of the surface in red and green, and
 * its height in alpha.
 */
const createWaveTexture = (device, seed) => {
    const size = 256;
    let state = seed * 9301 + 49297;
    const random = () => {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
    };

    // the trains of waves - the longer ones carry most of the height, and the shorter ones spread
    // further from the wind's direction
    const waves = [];
    for (let i = 0; i < 72; i++) {
        const k = 3 * Math.pow(14, random());
        const spread = 0.35 + (k / 42) * 0.6;
        const angle = (random() + random() + random() - 1.5) * spread * 1.6;
        const kx = Math.round(k * Math.cos(angle));
        const ky = Math.round(k * Math.sin(angle));
        if (kx === 0 && ky === 0) {
            continue;
        }
        const length = Math.hypot(kx, ky);
        waves.push({
            kx,
            ky,
            amplitude: Math.pow(length, -1.45) * Math.cos(angle * 0.5),
            phase: random() * Math.PI * 2
        });
    }

    const height = new Float32Array(size * size);
    const slopeX = new Float32Array(size * size);
    const slopeY = new Float32Array(size * size);
    let min = Infinity;
    let max = -Infinity;
    let steepest = 0;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let h = 0;
            let dx = 0;
            let dy = 0;
            for (const { kx, ky, amplitude, phase } of waves) {
                const a = ((kx * x + ky * y) / size) * Math.PI * 2 + phase;
                h += amplitude * Math.cos(a);
                const d = -amplitude * Math.sin(a) * Math.PI * 2;
                dx += d * kx;
                dy += d * ky;
            }
            const o = y * size + x;
            height[o] = h;
            slopeX[o] = dx;
            slopeY[o] = dy;
            min = Math.min(min, h);
            max = Math.max(max, h);
        }
    }

    // sharper crests and flatter troughs - the height bent upwards, and its slope with it
    const range = max - min;
    for (let o = 0; o < size * size; o++) {
        const t = (height[o] - min) / range;
        const bend = 0.55 + t * 0.9;
        slopeX[o] *= bend;
        slopeY[o] *= bend;
        height[o] = t * t * 0.6 + t * 0.4;
        steepest = Math.max(steepest, Math.abs(slopeX[o]), Math.abs(slopeY[o]));
    }

    const pixels = new Uint8Array(size * size * 4);
    for (let o = 0; o < size * size; o++) {
        pixels[o * 4] = Math.round((slopeX[o] / steepest) * 127.5 + 127.5);
        pixels[o * 4 + 1] = Math.round((slopeY[o] / steepest) * 127.5 + 127.5);
        pixels[o * 4 + 2] = 255;
        pixels[o * 4 + 3] = Math.round(height[o] * 255);
    }

    const texture = new Texture(device, {
        name: 'WaterWaves',
        width: size,
        height: size,
        format: PIXELFORMAT_RGBA8,
        mipmaps: true,
        minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        anisotropy: 8,
        levels: [pixels]
    });
    texture.upload();
    return texture;
};

// --------------------------------------------------------------------------------------------
// the water

// The water is drawn after the depth of everything under it has been rendered, so it knows how deep
// it is at every pixel - shallow water is light and clear, deep water dark, and the shore fades out
// softly with a line of foam instead of a hard edge. The waves are four bands of one texture of wind
// driven waves, at unrelated sizes, all running downwind at the speed waves of their length travel,
// and the waves are higher in some places than others, so no pattern repeats. The stronger the
// mission's wind, the choppier the sea, and the more whitecaps on it. The reflection is the procedural
// sky itself, so it follows the time of day.

const waterVertexGLSL = /* glsl */ `
    attribute vec3 vertex_position;

    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;
    uniform mat4 matrix_view;

    varying vec3 vWorldPos;
    varying float vDepth;

    void main(void) {
        vec4 world = matrix_model * vec4(vertex_position, 1.0);
        gl_Position = matrix_viewProjection * world;
        vWorldPos = world.xyz;
        vDepth = -(matrix_view * world).z;
    }
`;

const waterFragmentGLSL = /* glsl */ `
    #include "gammaPS"
    #include "screenDepthPS"

    ${atmosphereChunks.glsl}

    uniform vec3 view_position;
    uniform sampler2D uWaterNormals;
    uniform sampler2D uWaterNoise;
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec4 uWind;

    varying vec3 vWorldPos;
    varying float vDepth;

    vec2 waterRotate(vec2 p, float a) {
        float c = cos(a);
        float s = sin(a);
        return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    }

    // One band of waves - the wave texture at its own size, turned a little off the wind, and
    // drifting downwind at about the speed waves that long travel. Returns the slope of the water in
    // the world's frame, and the height of the waves.
    vec3 waterBand(vec2 p, vec2 wind, float size, float turn, float speed) {
        vec2 along = waterRotate(wind, turn);
        vec2 across = vec2(-along.y, along.x);
        vec2 q = vec2(dot(p, along) - uTime * speed, dot(p, across));
        vec4 t = texture2D(uWaterNormals, q / size + turn);
        vec2 n = t.xy * 2.0 - 1.0;
        return vec3(along * n.x + across * n.y, t.w);
    }

    void main(void) {
        vec2 p = vWorldPos.xz;
        vec3 toCamera = view_position - vWorldPos;
        float dist = length(toCamera);
        vec3 V = toCamera / dist;
        vec2 wind = uWind.xy;

        // calm and choppy patches, slowly wandering, and each band of waves stronger in some places than others
        vec4 macroA = texture2D(uWaterNoise, p / 3100.0 + uTime * vec2(0.0004, 0.0003));
        vec4 macroB = texture2D(uWaterNoise, waterRotate(p, 1.1) / 1270.0 - uTime * vec2(0.0005, 0.0002));
        float chop = mix(0.45, 1.25, smoothstep(0.3, 0.72, macroA.r * 0.7 + macroB.b * 0.3)) * mix(0.55, 1.3, uWind.z);

        // Four bands, their sizes unrelated, so their patterns never line up - each fades out once its
        // waves are too small to make out, before they shimmer. How much of the finer ones is gone
        // widens the sun's glitter instead.
        float footprint = length(fwidth(p));
        vec3 br = waterBand(p, wind, 8.7, 0.83, 1.8);
        vec3 b0 = waterBand(p, wind, 23.0, 0.21, 3.0);
        vec3 b1 = waterBand(p, wind, 61.0, -0.37, 4.9);
        vec3 b2 = waterBand(p, wind, 158.0, 0.53, 7.9);
        vec3 b3 = waterBand(p, wind, 410.0, -0.11, 12.6);
        float fr = 1.0 - smoothstep(8.7 / 90.0, 8.7 / 22.0, footprint);
        float f0 = 1.0 - smoothstep(23.0 / 90.0, 23.0 / 22.0, footprint);
        float f1 = 1.0 - smoothstep(61.0 / 90.0, 61.0 / 22.0, footprint);
        float f2 = 1.0 - smoothstep(158.0 / 90.0, 158.0 / 22.0, footprint);
        float f3 = 1.0 - smoothstep(410.0 / 90.0, 410.0 / 22.0, footprint);
        float wr = 0.22 * fr;
        float w0 = 0.3 * (0.5 + macroB.g) * f0;
        float w1 = 0.42 * (0.6 + macroA.g * 0.8) * f1;
        float w2 = 0.5 * (0.6 + macroB.r * 0.8) * f2;
        float w3 = 0.45 * (0.7 + macroA.b * 0.6) * f3;
        vec2 slope = (br.xy * wr + b0.xy * w0 + b1.xy * w1 + b2.xy * w2 + b3.xy * w3) * chop * 0.42;
        vec3 N = normalize(vec3(slope.x, 1.0, slope.y));

        // how deep the water is along the view, from the depth of the ground under it
        float thickness = max(getLinearScreenDepth() - vDepth, 0.0);

        // the body of the water, light and clear in the shallows, dark in the deep, its blue drifting
        // between greener and darker over the open sea
        vec3 shallow = vec3(0.05, 0.2, 0.17);
        vec3 deep = mix(vec3(0.004, 0.02, 0.034), vec3(0.006, 0.03, 0.03), macroB.a);
        vec3 body = mix(shallow, deep, 1.0 - exp(-thickness / 12.0));
        float sunUp = max(uSunDir.y, 0.0);
        vec3 color = body * (uSkyColor * 0.9 + uSunColor * sunUp * 0.3);

        // the sky reflected, mostly at a glancing angle
        float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 reflection = atmosphereSky(reflect(-V, N));

        // Far off, where the waves are too small to draw, the calm slicks mirror the sky and the
        // choppy patches scatter it - so the sea seen from high up is patchy rather than one mirror.
        float rough = clamp((chop - 0.45) / 0.8, 0.0, 1.0);
        fresnel *= mix(1.0, 1.25 - rough * 0.55, 1.0 - f1);

        // foam along the shore, broken up by noise
        float foamNoise = texture2D(uWaterNoise, p / 7.0 + uTime * vec2(0.02, -0.015)).g;
        float shore = 1.0 - smoothstep(0.0, 3.0, thickness);
        float foam = smoothstep(0.55, 0.8, foamNoise + shore * 0.45) * shore;

        // Whitecaps on the crests where the waves are breaking now, more of them the stronger the wind.
        // Too small to make out further away, they are an even lightening of the sea there instead.
        float crest = (b0.z - 0.5) * 0.3 * f0 + (b1.z - 0.5) * 0.4 + (b2.z - 0.5) * 0.45 + 0.5;
        float breaking = texture2D(uWaterNoise, p / 83.0 + uTime * vec2(0.012, 0.007)).b;
        float caps = smoothstep(0.66, 0.9, crest + (breaking - 0.5) * 0.6) * smoothstep(0.3, 0.85, uWind.z) * chop;
        caps *= smoothstep(0.3, 0.8, foamNoise);
        float near = 1.0 - smoothstep(3.0, 10.0, footprint);
        foam = max(foam, mix(0.025 * uWind.z * chop, caps * 0.65, near));

        // The sun glinting off the waves - a tight highlight where the small waves are drawn, spreading
        // into a wider glitter where they have faded out.
        float sharp = clamp(fr * 0.3 + f0 * 0.4 + f1 * 0.3, 0.0, 1.0);
        float power = mix(70.0, 900.0, sharp);
        vec3 H = normalize(uSunDir + V);
        float NdotH = max(dot(N, H), 0.0);
        float glint = pow(NdotH, power) * power * 0.018 + pow(NdotH, 60.0) * 0.25;

        color = mix(color, reflection, fresnel * (1.0 - foam));
        color += uSunColor * glint * (1.0 - foam) * smoothstep(-0.05, 0.05, uSunDir.y);
        color = mix(color, (uSkyColor + uSunColor * sunUp) * 0.75, foam * 0.7);

        // fading in over the first meter, so the shoreline has no hard edge
        float alpha = smoothstep(0.0, 1.2, thickness);

        color = atmosphereApply(color, view_position, vWorldPos, 1.0);
        gl_FragColor = vec4(gammaCorrectOutput(color), alpha);
    }
`;

const waterVertexWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;

    uniform matrix_model: mat4x4f;
    uniform matrix_viewProjection: mat4x4f;
    uniform matrix_view: mat4x4f;

    varying vWorldPos: vec3f;
    varying vDepth: f32;

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        let world = uniform.matrix_model * vec4f(input.vertex_position, 1.0);
        output.position = uniform.matrix_viewProjection * world;
        output.vWorldPos = world.xyz;
        output.vDepth = -(uniform.matrix_view * world).z;
        return output;
    }
`;

const waterFragmentWGSL = /* wgsl */ `
    #include "gammaPS"
    #include "screenDepthPS"

    ${atmosphereChunks.wgsl}

    uniform view_position: vec3f;
    var uWaterNormals: texture_2d<f32>;
    var uWaterNormalsSampler: sampler;
    var uWaterNoise: texture_2d<f32>;
    var uWaterNoiseSampler: sampler;
    uniform uTime: f32;
    uniform uSunDir: vec3f;
    uniform uSunColor: vec3f;
    uniform uSkyColor: vec3f;
    uniform uWind: vec4f;

    varying vWorldPos: vec3f;
    varying vDepth: f32;

    fn waterRotate(p: vec2f, a: f32) -> vec2f {
        let c = cos(a);
        let s = sin(a);
        return vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
    }

    // One band of waves - the wave texture at its own size, turned a little off the wind, and
    // drifting downwind at about the speed waves that long travel. Returns the slope of the water in
    // the world's frame, and the height of the waves.
    fn waterBand(p: vec2f, wind: vec2f, size: f32, turn: f32, speed: f32) -> vec3f {
        let along = waterRotate(wind, turn);
        let across = vec2f(-along.y, along.x);
        let q = vec2f(dot(p, along) - uniform.uTime * speed, dot(p, across));
        let t = textureSample(uWaterNormals, uWaterNormalsSampler, q / size + turn);
        let n = t.xy * 2.0 - 1.0;
        return vec3f(along * n.x + across * n.y, t.w);
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let p = input.vWorldPos.xz;
        let toCamera = uniform.view_position - input.vWorldPos;
        let dist = length(toCamera);
        let V = toCamera / dist;
        let time = uniform.uTime;
        let wind = uniform.uWind.xy;

        // calm and choppy patches, slowly wandering, and each band of waves stronger in some places than others
        let macroA = textureSample(uWaterNoise, uWaterNoiseSampler, p / 3100.0 + time * vec2f(0.0004, 0.0003));
        let macroB = textureSample(uWaterNoise, uWaterNoiseSampler, waterRotate(p, 1.1) / 1270.0 - time * vec2f(0.0005, 0.0002));
        let chop = mix(0.45, 1.25, smoothstep(0.3, 0.72, macroA.r * 0.7 + macroB.b * 0.3)) * mix(0.55, 1.3, uniform.uWind.z);

        // Four bands, their sizes unrelated, so their patterns never line up - each fades out once its
        // waves are too small to make out, before they shimmer. How much of the finer ones is gone
        // widens the sun's glitter instead.
        let footprint = length(fwidth(p));
        let br = waterBand(p, wind, 8.7, 0.83, 1.8);
        let b0 = waterBand(p, wind, 23.0, 0.21, 3.0);
        let b1 = waterBand(p, wind, 61.0, -0.37, 4.9);
        let b2 = waterBand(p, wind, 158.0, 0.53, 7.9);
        let b3 = waterBand(p, wind, 410.0, -0.11, 12.6);
        let fr = 1.0 - smoothstep(8.7 / 90.0, 8.7 / 22.0, footprint);
        let f0 = 1.0 - smoothstep(23.0 / 90.0, 23.0 / 22.0, footprint);
        let f1 = 1.0 - smoothstep(61.0 / 90.0, 61.0 / 22.0, footprint);
        let f2 = 1.0 - smoothstep(158.0 / 90.0, 158.0 / 22.0, footprint);
        let f3 = 1.0 - smoothstep(410.0 / 90.0, 410.0 / 22.0, footprint);
        let wr = 0.22 * fr;
        let w0 = 0.3 * (0.5 + macroB.g) * f0;
        let w1 = 0.42 * (0.6 + macroA.g * 0.8) * f1;
        let w2 = 0.5 * (0.6 + macroB.r * 0.8) * f2;
        let w3 = 0.45 * (0.7 + macroA.b * 0.6) * f3;
        let slope = (br.xy * wr + b0.xy * w0 + b1.xy * w1 + b2.xy * w2 + b3.xy * w3) * chop * 0.42;
        let N = normalize(vec3f(slope.x, 1.0, slope.y));

        // the shore foam's noise, sampled here in uniform control flow
        let foamNoise = textureSample(uWaterNoise, uWaterNoiseSampler, p / 7.0 + time * vec2f(0.02, -0.015)).g;
        let breaking = textureSample(uWaterNoise, uWaterNoiseSampler, p / 83.0 + time * vec2f(0.012, 0.007)).b;

        // how deep the water is along the view, from the depth of the ground under it
        let thickness = max(getLinearScreenDepthFrag() - input.vDepth, 0.0);

        // the body of the water, light and clear in the shallows, dark in the deep, its blue drifting
        // between greener and darker over the open sea
        let shallow = vec3f(0.05, 0.2, 0.17);
        let deep = mix(vec3f(0.004, 0.02, 0.034), vec3f(0.006, 0.03, 0.03), vec3f(macroB.a));
        let body = mix(shallow, deep, vec3f(1.0 - exp(-thickness / 12.0)));
        let sunUp = max(uniform.uSunDir.y, 0.0);
        var color = body * (uniform.uSkyColor * 0.9 + uniform.uSunColor * sunUp * 0.3);

        // the sky reflected, mostly at a glancing angle
        let reflection = atmosphereSky(reflect(-V, N));

        // Far off, where the waves are too small to draw, the calm slicks mirror the sky and the
        // choppy patches scatter it - so the sea seen from high up is patchy rather than one mirror.
        let rough = clamp((chop - 0.45) / 0.8, 0.0, 1.0);
        let fresnel = (0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0)) * mix(1.0, 1.25 - rough * 0.55, 1.0 - f1);

        // foam along the shore, broken up by noise
        let shore = 1.0 - smoothstep(0.0, 3.0, thickness);
        var foam = smoothstep(0.55, 0.8, foamNoise + shore * 0.45) * shore;

        // Whitecaps on the crests where the waves are breaking now, more of them the stronger the wind.
        // Too small to make out further away, they are an even lightening of the sea there instead.
        let crest = (b0.z - 0.5) * 0.3 * f0 + (b1.z - 0.5) * 0.4 + (b2.z - 0.5) * 0.45 + 0.5;
        let caps =
            smoothstep(0.66, 0.9, crest + (breaking - 0.5) * 0.6) *
            smoothstep(0.3, 0.85, uniform.uWind.z) *
            chop *
            smoothstep(0.3, 0.8, foamNoise);
        let near = 1.0 - smoothstep(3.0, 10.0, footprint);
        foam = max(foam, mix(0.025 * uniform.uWind.z * chop, caps * 0.65, near));

        // The sun glinting off the waves - a tight highlight where the small waves are drawn, spreading
        // into a wider glitter where they have faded out.
        let sharp = clamp(fr * 0.3 + f0 * 0.4 + f1 * 0.3, 0.0, 1.0);
        let power = mix(70.0, 900.0, sharp);
        let H = normalize(uniform.uSunDir + V);
        let NdotH = max(dot(N, H), 0.0);
        let glint = pow(NdotH, power) * power * 0.018 + pow(NdotH, 60.0) * 0.25;

        color = mix(color, reflection, vec3f(fresnel * (1.0 - foam)));
        color = color + uniform.uSunColor * glint * (1.0 - foam) * smoothstep(-0.05, 0.05, uniform.uSunDir.y);
        color = mix(color, (uniform.uSkyColor + uniform.uSunColor * sunUp) * 0.75, vec3f(foam * 0.7));

        // fading in over the first meter, so the shoreline has no hard edge
        let alpha = smoothstep(0.0, 1.2, thickness);

        color = atmosphereApply(color, uniform.view_position, input.vWorldPos, 1.0);
        output.color = vec4f(gammaCorrectOutput(color), alpha);
        return output;
    }
`;

// the lighting of the water, and the wind on it, as uniform values
const _sunDir = new Float32Array(3);
const _wind = new Float32Array(4);
const _sunColor = new Float32Array(3);
const _skyColor = new Float32Array(3);

// --------------------------------------------------------------------------------------------
// the terrain

/**
 * A flattened pad where an enemy base stands.
 *
 * @typedef {object} Site
 * @property {number} x - The x coordinate of its center.
 * @property {number} z - The z coordinate of its center.
 * @property {number} y - The height of the pad.
 * @property {number} radius - The radius of the pad.
 */

export class Terrain {
    /**
     * Generates the terrain.
     *
     * @param {AppBase} app - The application.
     * @param {object} options - The options.
     * @param {number} options.seed - The seed of the landscape.
     * @param {number} options.siteCount - How many base sites to find and flatten.
     * @param {Vec3} options.start - Where the player starts, which the sites are placed in front of.
     * @param {Vec3} options.forward - The direction the player starts flying in.
     * @param {Layer} options.waterLayer - The layer the water is drawn in, after the depth of the scene
     * has been rendered.
     * @param {{ albedo: Texture, normal: Texture }} options.maps - The texture arrays of the ground's
     * layers, from createTerrainMaps, shared by every terrain.
     */
    constructor(app, { seed, siteCount, start, forward, waterLayer, maps }) {
        this.app = app;
        this.seed = seed;
        this.maps = maps;

        // the exponential growth rate that makes the outer grid reach the horizon
        const outerQuads = (GRID_QUADS - INNER_QUADS) / 2;
        const needed = (OUTER_EXTENT - COMBAT_RADIUS) / INNER_SPACING;
        let low = 0.0001;
        let high = 1;
        for (let i = 0; i < 60; i++) {
            const k = (low + high) * 0.5;
            if ((Math.exp(k * outerQuads) - 1) / k > needed) {
                high = k;
            } else {
                low = k;
            }
        }
        this._growth = (low + high) * 0.5;

        // past the combat area the spacing between grid lines grows by this much per meter
        this._growthPerMeter = this._growth;

        this._continent = createNoise(seed);
        this._hills = createNoise(seed + 101);
        this._ridges = createNoise(seed + 202);
        this._detail = createNoise(seed + 303);
        this._massifs = createNoise(seed + 404);
        this._startX = start.x;
        this._startZ = start.z;

        /** @type {Site[]} */
        this.sites = [];
        this._findSites(siteCount, start, forward);

        this._buildGrid();
        this._createEntity(waterLayer);
    }

    /**
     * The height of the landscape before any sites are flattened into it.
     *
     * @param {number} x - The x coordinate.
     * @param {number} z - The z coordinate.
     * @returns {number} The height.
     * @private
     */
    _rawHeight(x, z) {
        const distance = Math.hypot(x, z);

        // Out where the grid stretches, its vertices are far apart, and noise finer than a few of
        // them only aliases into needles. Each octave fades out once it is too fine for the grid.
        const spacing = INNER_SPACING + Math.max(0, distance - COMBAT_RADIUS) * this._growthPerMeter;
        const octave = (wavelength) => math.smoothstep(spacing * 3, spacing * 6, wavelength);

        const continent =
            this._continent(x / 9000, z / 9000) * 0.6 + this._continent(x / 4300 + 7.3, z / 4300 - 2.1) * 0.4;

        // rolling hills everywhere
        let hills = 0;
        let amplitude = 1;
        let wavelength = 2100;
        for (let i = 0; i < 5; i++) {
            hills += this._hills(x / wavelength, z / wavelength) * amplitude * octave(wavelength);
            amplitude *= 0.48;
            wavelength /= 2.07;
        }

        // ridged mountains where the continent rises, and in a ring around the horizon - their ridges
        // wander, warped by a smooth noise, rather than lining up along the noise's own lattice
        const rx = x + this._hills(x / 1700 + 3.1, z / 1700 - 1.7) * 420;
        const rz = z + this._hills(x / 1700 - 5.3, z / 1700 + 2.9) * 420;
        let ridges = 0;
        amplitude = 1;
        wavelength = 4200;
        let weight = 1;
        for (let i = 0; i < 5; i++) {
            // the noise reaches a little past one, which would take the power of a negative number -
            // a NaN height, and a hole in the terrain ringed by black, unlit triangles
            let n = Math.max(0, 1 - Math.abs(this._ridges(rx / wavelength, rz / wavelength)));
            n = Math.pow(n, 1.6) * weight;
            weight = math.clamp(n * 1.4, 0, 1);
            ridges += n * amplitude * octave(wavelength);
            amplitude *= 0.5;
            wavelength /= 2.1;
        }

        // Mountains where the continent rises, and in a ring around the horizon - and massifs of their
        // own all over the combat area, so most landscapes have a range or two to fly through and round,
        // rising out of the sea as mountainous islands.
        const ring = math.smoothstep(COMBAT_RADIUS * 0.85, COMBAT_RADIUS * 2.4, distance);
        // kept clear of where the player comes in, which the jet circles over during the briefing
        const fromStart = Math.hypot(x - this._startX, z - this._startZ);
        const massifs =
            math.smoothstep(0.08, 0.45, this._massifs(x / MASSIF_SIZE, z / MASSIF_SIZE)) *
            (1 - ring) *
            math.smoothstep(MASSIF_CLEARANCE, MASSIF_CLEARANCE * 1.8, fromStart);
        const mountains = Math.max(
            math.smoothstep(0.15, 0.65, continent + ring * 0.8) * (0.45 + ring * 1.3),
            massifs * MASSIF_HEIGHT
        );

        // The mountains rise on a power of the ridges a little under two - their flanks curve up into
        // sharp crests, without the tall spires of a square - to a little over a kilometer.
        let height =
            60 + continent * 90 + hills * 110 + Math.pow(ridges, 1.8) * 470 * mountains + ridges * mountains * 120;

        // The lowland sinks below the sea, but for islands where the noise dips. The edges of the
        // smoothstep must rise - reversed, it is a step, which drops the shore 110 m in one quad.
        height -= math.smoothstep(-0.42, -0.2, continent + hills * 0.3) * 110;

        // fine detail, mostly on the high ground
        height += this._detail(x / 260, z / 260) * (5 + mountains * 25) * octave(260);
        return height;
    }

    /**
     * The height of the landscape with the base sites flattened into it.
     *
     * @param {number} x - The x coordinate.
     * @param {number} z - The z coordinate.
     * @returns {number} The height.
     * @private
     */
    _height(x, z) {
        let height = this._rawHeight(x, z);
        for (let i = 0; i < this.sites.length; i++) {
            const site = this.sites[i];
            const d = Math.hypot(x - site.x, z - site.z);
            if (d < site.radius * 2.2) {
                const pad = 1 - math.smoothstep(site.radius * 0.9, site.radius * 2.2, d);
                height = math.lerp(height, site.y, pad);
            }
        }

        // Pushed away from the water level, so the ground crosses it steeply. A gentle shore leaves the
        // land and the water nearly coplanar over a wide strip, which the depth buffer cannot tell apart
        // at a distance, and the shoreline flickers.
        return height + 1.5 * Math.tanh(height / 3);
    }

    /**
     * Picks flat, dry ground for the enemy bases, spread out in front of the player.
     *
     * @param {number} count - How many sites to find.
     * @param {Vec3} start - Where the player starts.
     * @param {Vec3} forward - The direction the player starts flying in.
     * @private
     */
    _findSites(count, start, forward) {
        const heading = Math.atan2(forward.x, forward.z);
        let attempts = 0;
        let random = this.seed * 9301 + 49297;
        const next = () => {
            random = (random * 9301 + 49297) % 233280;
            return random / 233280;
        };

        while (this.sites.length < count && attempts < 4000) {
            attempts++;

            // in a wide arc ahead of the start, between four and nine kilometers out
            const angle = heading + (next() - 0.5) * Math.PI * 1.2;
            const distance = 4000 + next() * 5000;
            const x = start.x + Math.sin(angle) * distance;
            const z = start.z + Math.cos(angle) * distance;
            if (Math.hypot(x, z) > COMBAT_RADIUS * 0.85) {
                continue;
            }

            const h = this._rawHeight(x, z);
            if (h < 15 || h > 420) {
                continue;
            }

            // reasonably flat across the whole pad
            const radius = 120;
            let flat = true;
            for (let k = 0; k < 8 && flat; k++) {
                const a = (k / 8) * Math.PI * 2;
                const s = this._rawHeight(x + Math.cos(a) * radius, z + Math.sin(a) * radius);
                flat = Math.abs(s - h) < 30 && s > 8;
            }
            if (!flat) {
                continue;
            }

            if (this.sites.some((site) => Math.hypot(site.x - x, site.z - z) < 1600)) {
                continue;
            }

            this.sites.push({ x, z, y: h, radius });
        }
    }

    /**
     * The world coordinate of a grid line.
     *
     * @param {number} index - The index of the grid line.
     * @returns {number} The coordinate.
     * @private
     */
    _gridCoordinate(index) {
        const d = index - GRID_QUADS / 2;
        const a = Math.abs(d);
        const inner = INNER_QUADS / 2;
        if (a <= inner) {
            return d * INNER_SPACING;
        }
        const t = a - inner;
        return (
            Math.sign(d) * (inner * INNER_SPACING + (INNER_SPACING * (Math.exp(this._growth * t) - 1)) / this._growth)
        );
    }

    /**
     * Samples the heights on the grid and computes the normals.
     *
     * @private
     */
    _buildGrid() {
        const count = GRID_QUADS + 1;
        this._coords = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            this._coords[i] = this._gridCoordinate(i);
        }

        const heights = new Float32Array(count * count);
        for (let j = 0; j < count; j++) {
            const z = this._coords[j];
            for (let i = 0; i < count; i++) {
                heights[j * count + i] = this._height(this._coords[i], z);
            }
        }
        this._heights = heights;

        const normals = new Float32Array(count * count * 3);
        const c = this._coords;
        for (let j = 0; j < count; j++) {
            const j0 = Math.max(j - 1, 0);
            const j1 = Math.min(j + 1, count - 1);
            for (let i = 0; i < count; i++) {
                const i0 = Math.max(i - 1, 0);
                const i1 = Math.min(i + 1, count - 1);
                const dx = (heights[j * count + i1] - heights[j * count + i0]) / (c[i1] - c[i0]);
                const dz = (heights[j1 * count + i] - heights[j0 * count + i]) / (c[j1] - c[j0]);
                const length = Math.hypot(dx, 1, dz);
                const o = (j * count + i) * 3;
                normals[o] = -dx / length;
                normals[o + 1] = 1 / length;
                normals[o + 2] = -dz / length;
            }
        }
        this._normals = normals;
    }

    /**
     * Builds the tiles, the water and their materials.
     *
     * @param {Layer} waterLayer - The layer the water is drawn in.
     * @private
     */
    _createEntity(waterLayer) {
        const device = this.app.graphicsDevice;
        const count = GRID_QUADS + 1;

        this.noiseTexture = createNoiseTexture(device, this.seed);

        const material = new StandardMaterial();
        material.useMetalness = true;
        material.metalness = 0;
        material.gloss = 0.18;
        applyAtmosphere(material);
        material.getShaderChunks(SHADERLANGUAGE_GLSL).set('diffusePS', terrainGLSL);
        material.getShaderChunks(SHADERLANGUAGE_GLSL).set('normalMapPS', terrainNormalGLSL);
        material.getShaderChunks(SHADERLANGUAGE_WGSL).set('diffusePS', terrainWGSL);
        material.getShaderChunks(SHADERLANGUAGE_WGSL).set('normalMapPS', terrainNormalWGSL);
        material.setParameter('terrainNoiseMap', this.noiseTexture);
        material.setParameter('terrainAlbedoMaps', this.maps.albedo);
        material.setParameter('terrainNormalMaps', this.maps.normal);
        const layers = new Float32Array(LAYER_COUNT * 4);
        TERRAIN_LAYERS.forEach(({ mean, size }, i) => {
            layers.set([...mean, size], i * 4);
        });
        material.setParameter('terrainLayers[0]', layers);

        const sites = new Float32Array(MAX_SITES * 4);
        this.sites.forEach((site, i) => {
            sites[i * 4] = site.x;
            sites[i * 4 + 1] = site.z;
            sites[i * 4 + 2] = site.radius;
            sites[i * 4 + 3] = 1;
        });
        material.setParameter('terrainSites[0]', sites);
        material.update();
        this.material = material;

        this.entity = new Entity('Terrain');
        const meshInstances = [];
        const tiles = GRID_QUADS / TILE_QUADS;
        for (let tj = 0; tj < tiles; tj++) {
            for (let ti = 0; ti < tiles; ti++) {
                const size = TILE_QUADS + 1;
                const positions = new Float32Array(size * size * 3);
                const normals = new Float32Array(size * size * 3);
                for (let j = 0; j < size; j++) {
                    for (let i = 0; i < size; i++) {
                        const gi = ti * TILE_QUADS + i;
                        const gj = tj * TILE_QUADS + j;
                        const src = gj * count + gi;
                        const dst = (j * size + i) * 3;
                        positions[dst] = this._coords[gi];
                        positions[dst + 1] = this._heights[src];
                        positions[dst + 2] = this._coords[gj];
                        normals[dst] = this._normals[src * 3];
                        normals[dst + 1] = this._normals[src * 3 + 1];
                        normals[dst + 2] = this._normals[src * 3 + 2];
                    }
                }

                // the same diagonal heightAt assumes, from the top right to the bottom left corner
                const indices = new Uint16Array(TILE_QUADS * TILE_QUADS * 6);
                let k = 0;
                for (let j = 0; j < TILE_QUADS; j++) {
                    for (let i = 0; i < TILE_QUADS; i++) {
                        const i0 = j * size + i;
                        const i1 = i0 + 1;
                        const i2 = i0 + size;
                        const i3 = i2 + 1;
                        indices[k++] = i0;
                        indices[k++] = i2;
                        indices[k++] = i1;
                        indices[k++] = i1;
                        indices[k++] = i2;
                        indices[k++] = i3;
                    }
                }

                const mesh = new Mesh(device);
                mesh.setPositions(positions);
                mesh.setNormals(normals);
                mesh.setIndices(indices);
                mesh.update(PRIMITIVE_TRIANGLES);
                meshInstances.push(new MeshInstance(mesh, material));
            }
        }

        // the ground only receives shadows - the player's jet is the one thing that casts them
        this.entity.addComponent('render', {
            meshInstances,
            castShadows: false,
            receiveShadows: true
        });
        this.app.root.addChild(this.entity);

        const water = new ShaderMaterial({
            uniqueName: 'SplashOneWater',
            vertexGLSL: waterVertexGLSL,
            fragmentGLSL: waterFragmentGLSL,
            vertexWGSL: waterVertexWGSL,
            fragmentWGSL: waterFragmentWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });
        water.blendType = BLEND_NORMAL;
        water.depthWrite = true;
        this.waterNormals = createWaveTexture(device, this.seed);
        water.setParameter('uWaterNormals', this.waterNormals);
        water.setParameter('uWaterNoise', this.noiseTexture);
        water.setParameter('uTime', 0);
        water.setParameter('uWind', [1, 0, 0.5, 0]);
        water.update();
        this.waterMaterial = water;

        // one sheet at sea level reaching out to the horizon, divided up rather than two triangles, as
        // triangles kilometers across interpolate their depth poorly
        const waterGeometry = new PlaneGeometry({
            halfExtents: new Vec2(OUTER_EXTENT * 1.1, OUTER_EXTENT * 1.1),
            widthSegments: 64,
            lengthSegments: 64
        });
        this.water = new Entity('Water');
        this.water.addComponent('render', {
            meshInstances: [new MeshInstance(Mesh.fromGeometry(device, waterGeometry), water)],
            castShadows: false,
            receiveShadows: false,
            layers: [waterLayer.id]
        });
        this.app.root.addChild(this.water);
    }

    /**
     * Removes the terrain and the water, and frees their resources.
     */
    destroy() {
        this.entity.destroy();
        this.water.destroy();
        this.noiseTexture.destroy();
        this.waterNormals.destroy();
        this.material.destroy();
        this.waterMaterial.destroy();
    }

    /**
     * Drifts the ripples on the water.
     *
     * @param {number} time - The current time.
     */
    update(time) {
        this.waterMaterial.setParameter('uTime', time);
    }

    /**
     * Sets the wind the waves are raised by.
     *
     * @param {number} x - The x of the wind's velocity, in meters per second.
     * @param {number} z - The z of the wind's velocity.
     */
    setWind(x, z) {
        const speed = Math.hypot(x, z);
        _wind[0] = speed > 0 ? x / speed : 1;
        _wind[1] = speed > 0 ? z / speed : 0;
        _wind[2] = math.clamp(speed / 7, 0.15, 1);
        this.waterMaterial.setParameter('uWind', _wind);
    }

    /**
     * Sets the light the water picks up.
     *
     * @param {Vec3} sunDir - The direction towards the sun.
     * @param {Color} sunColor - The color of the sunlight, scaled by its intensity.
     * @param {Color} skyColor - The light coming from the sky.
     */
    setLighting(sunDir, sunColor, skyColor) {
        const material = this.waterMaterial;
        _sunDir[0] = sunDir.x;
        _sunDir[1] = sunDir.y;
        _sunDir[2] = sunDir.z;
        _sunColor[0] = sunColor.r;
        _sunColor[1] = sunColor.g;
        _sunColor[2] = sunColor.b;
        _skyColor[0] = skyColor.r;
        _skyColor[1] = skyColor.g;
        _skyColor[2] = skyColor.b;
        material.setParameter('uSunDir', _sunDir);
        material.setParameter('uSunColor', _sunColor);
        material.setParameter('uSkyColor', _skyColor);
    }

    /**
     * Finds the grid cell a coordinate falls in.
     *
     * @param {number} v - The coordinate.
     * @returns {number} The index of the grid line at or before it.
     * @private
     */
    _cell(v) {
        const inner = INNER_QUADS / 2;
        const a = Math.abs(v);
        let d;
        if (a <= inner * INNER_SPACING) {
            d = a / INNER_SPACING;
        } else {
            d = inner + Math.log(1 + (this._growth * (a - inner * INNER_SPACING)) / INNER_SPACING) / this._growth;
        }
        const index = Math.floor(GRID_QUADS / 2 + Math.sign(v) * d);
        return math.clamp(index, 0, GRID_QUADS - 1);
    }

    /**
     * The height of the visible ground at a point.
     *
     * @param {number} x - The x coordinate.
     * @param {number} z - The z coordinate.
     * @returns {number} The height of the ground.
     */
    heightAt(x, z) {
        const count = GRID_QUADS + 1;
        const c = this._coords;
        let i = this._cell(x);
        let j = this._cell(z);

        // the analytic inverse can land one cell off at the boundaries, so settle it
        while (i > 0 && x < c[i]) i--;
        while (i < GRID_QUADS - 1 && x > c[i + 1]) i++;
        while (j > 0 && z < c[j]) j--;
        while (j < GRID_QUADS - 1 && z > c[j + 1]) j++;

        const fx = math.clamp((x - c[i]) / (c[i + 1] - c[i]), 0, 1);
        const fz = math.clamp((z - c[j]) / (c[j + 1] - c[j]), 0, 1);
        const h = this._heights;
        const h00 = h[j * count + i];
        const h10 = h[j * count + i + 1];
        const h01 = h[(j + 1) * count + i];
        const h11 = h[(j + 1) * count + i + 1];

        if (fx + fz <= 1) {
            return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
        }
        return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
    }

    /**
     * The height of the ground or the water, whichever is higher.
     *
     * @param {number} x - The x coordinate.
     * @param {number} z - The z coordinate.
     * @returns {number} The height of the surface.
     */
    surfaceAt(x, z) {
        return Math.max(this.heightAt(x, z), 0);
    }

    /**
     * The normal of the ground at a point.
     *
     * @param {number} x - The x coordinate.
     * @param {number} z - The z coordinate.
     * @param {Vec3} out - Receives the normal.
     * @returns {Vec3} The normal.
     */
    normalAt(x, z, out) {
        const e = 6;
        const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
        const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
        return out.set(-dx, 2 * e, -dz).normalize();
    }
}
