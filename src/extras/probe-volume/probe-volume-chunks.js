// The shader chunk evaluating the ambient lighting of a probe volume. It replaces the ambientModifierPS
// chunk of the lit shader, and modifies the ambient lighting of the materials with the PROBE_VOLUME
// define, leaving the other materials unchanged.
//
// The probes hold L1 spherical harmonics of the incoming radiance. A 3D texture stores them as
// three sub-volumes stacked along its depth, one for each of the red, green and blue channels, and
// each texel holds the L0 and the three L1 coefficients of one channel of one probe. The probes are
// at the centers of the cells of a grid dividing the box of the volume, and the hardware filters the
// texels trilinearly between the eight probes around a position.
//
// To reduce light leaking, the weights of the eight probes can additionally exclude the invalid
// probes, which are inside geometry, and favor the probes in front of the surface. The weights are
// collapsed into a single sample position the hardware filtering approximates them at, so this
// costs a fetch of the validity of the probes, but no additional filtered fetches.
//
// The probes moved out of geometry when baked, see ProbeVolume#offsets, are interpolated at their
// grid positions, but the leak reduction and the visibility use the positions they were captured
// at, which costs a fetch of the offset of each of the eight probes but the first, whose offset
// comes with the validity. A probe moved out of a wall to
// one side then counts as behind the wall for the surfaces on its other side.
//
// With visibility, the weights also exclude the probes the surface is hidden from. Each probe has
// an octahedral map of the mean and the mean squared distance to the closest surface around each
// direction, in a tile of a 2D atlas, and the weight of a probe is the Chebyshev bound of the
// probability that it sees the surface (Majercik et al., DDGI). This costs a filtered fetch of the
// atlas for each of the eight probes.
//
// The probes also occlude the reflections of the environment where they are darker than it, such
// as inside a closed room, which would otherwise reflect the sky. The lit shader scales the
// reflections by getReflectionOcclusion, the ratio of the luminance of the ambient of the probes to
// that of the environment, up to 1.
//
// With the PROBE_VOLUME_DEBUG define, the material shows the probe of the cell of the surface, as it
// is stored, for small spheres around the probes, which can be drawn with a single instanced draw.

const probeVolumeChunkGLSL = /* glsl */`
#ifdef PROBE_VOLUME

uniform highp sampler3D probeVolumeTexture;

// for each probe, in xyz, its offset from its position in units of its cell, mapped to 1..255, and
// in w, the validity of the eight probes of the cell it is the first corner of, as bits
uniform highp sampler3D probeVolumeValidity;

// the box of the volume, and the inverse of its size
uniform vec3 probeVolumeMin;
uniform vec3 probeVolumeMax;
uniform vec3 probeVolumeInvSize;

// the number of probes along each axis, and the size of their cells
uniform vec3 probeVolumeCount;
uniform vec3 probeVolumeCellSize;

// x: normal bias, y: intensity, z: SH sharpening weight, w: leak reduction weight
uniform vec4 probeVolumeParams;

// x: inverse of the distance over which the volume blends to the environment, y: blend weight,
// z: reflection occlusion weight
uniform vec3 probeVolumeBlend;

// x: 1 for 8-bit texels, 0 for half float texels, y: the scale of L0 of 8-bit texels
uniform vec2 probeVolumeEncoding;

// the atlas of the octahedral maps of the visibility of the probes, in tiles with a border of one
// texel, each texel holding the mean and the mean squared distance to the closest surface
uniform sampler2D probeVolumeVisibility;

// x: 1 to use the visibility, 0 to not, y: tiles along a row of the atlas, z: texels along a side
// of a map
uniform vec4 probeVolumeVisibilityParams;

// the inverse of the size of the atlas
uniform vec2 probeVolumeVisibilityInvSize;

// the scale of the reflections of the environment, set by getProbeVolumeAmbient
float dProbeVolumeReflection = 1.0;

// returns the L0 and L1 coefficients of a channel. Half float texels store them as they are, and
// 8-bit texels store sqrt(L0 / scale) and L1 / (sqrt(3) * L0) mapped to 0..1
vec4 decodeProbeVolumeTexel(vec4 texel) {
    float l0 = texel.x * mix(1.0, texel.x * probeVolumeEncoding.y, probeVolumeEncoding.x);
    vec3 l1 = mix(texel.yzw, (texel.yzw * 2.0 - 1.0) * (1.7320508 * l0), probeVolumeEncoding.x);
    return vec4(l0, l1);
}

// the irradiance divided by pi of a channel, from the radiance SH of the channel
float evaluateProbeVolumeChannel(vec4 sh, vec3 normal, vec3 axis, float zonal) {

    // L0 and L1 convolved with the clamped cosine lobe, band factors 1 and 2/3
    float irradiance = 0.282095 * sh.x + 0.325735 * dot(sh.yzw, normal);

    // a quadratic zonal harmonic along the shared axis, its coefficient estimated from how
    // directional the L1 coefficients are (ZH3, Roughton et al., I3D 2024)
    float ratio = min(abs(dot(sh.yzw, axis)) / max(sh.x, 1e-6), 1.7320508);
    return irradiance + zonal * sh.x * (0.08 * ratio + 0.6 * ratio * ratio);
}

// the octahedral coordinates of a direction, in 0..1 (Cigolle et al., JCGT 2014)
vec2 probeVolumeOctahedral(vec3 dir) {
    vec2 p = dir.xy / (abs(dir.x) + abs(dir.y) + abs(dir.z));
    if (dir.z < 0.0) {
        p = (1.0 - abs(p.yx)) * vec2(p.x >= 0.0 ? 1.0 : -1.0, p.y >= 0.0 ? 1.0 : -1.0);
    }
    return p * 0.5 + 0.5;
}

// the visibility of a probe from a position: the Chebyshev bound of the probability that the probe
// sees the position, from the mean and the variance of the distances it sees in its direction
float getProbeVolumeVisibility(float probe, vec3 fromProbe) {

    // the direction in the map of the probe, inside the border of its tile
    float tilesPerRow = probeVolumeVisibilityParams.y;
    float size = probeVolumeVisibilityParams.z;
    float row = floor((probe + 0.5) / tilesPerRow);
    vec2 tile = vec2(probe - row * tilesPerRow, row);
    float dist = length(fromProbe);
    vec2 octahedral = probeVolumeOctahedral(fromProbe / max(dist, 1e-6));
    vec2 uv = (tile * (size + 2.0) + 1.0 + octahedral * size) * probeVolumeVisibilityInvSize;
    vec2 moments = textureLod(probeVolumeVisibility, uv, 0.0).rg;

    if (dist <= moments.x) {
        return 1.0;
    }
    float variance = abs(moments.y - moments.x * moments.x);
    float delta = dist - moments.x;
    float chebyshev = variance / (variance + delta * delta);

    // sharpened, and never zero, so that a position hidden from all probes still has a fallback
    return max(chebyshev * chebyshev * chebyshev, 0.05);
}

// the grid coordinates of the probes to sample at a surface, the probes at whole coordinates
vec3 getProbeVolumeGrid(vec3 worldNormal) {

    // sample in front of the surface, so that the probes behind it contribute less
    vec3 position = litArgs_worldPosition + worldNormal * probeVolumeParams.x;

    // clamped to the probes, so that positions outside of them use the border probes
    vec3 grid = clamp((position - probeVolumeMin) * probeVolumeInvSize * probeVolumeCount - 0.5, vec3(0.0), probeVolumeCount - 1.0);

    // the weights of the eight probes around the position: trilinear, and to reduce leaking, zero
    // for the invalid probes and smaller for the probes behind the surface
    vec3 base = min(floor(grid), max(probeVolumeCount - 2.0, vec3(0.0)));
    vec3 offset = grid - base;
    vec4 baseTexel = textureLod(probeVolumeValidity, (base + 0.5) / probeVolumeCount, 0.0);
    int validity = int(baseTexel.w * 255.0 + 0.5);
    float leakReduction = probeVolumeParams.w;
    bool useOffsets = leakReduction > 0.0 || probeVolumeVisibilityParams.x > 0.0;

    vec3 center = vec3(0.0);
    float weightSum = 0.0;
    for (int i = 0; i < 8; i++) {
        vec3 corner = vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
        vec3 trilinear = mix(1.0 - offset, offset, corner);
        float weight = trilinear.x * trilinear.y * trilinear.z;

        // the position the probe was captured at, and the direction to it from the surface
        // (Majercik et al., DDGI)
        vec3 probeGrid = base + corner;
        vec3 probeOffset = vec3(0.0);
        if (useOffsets) {
            vec3 encoded = i == 0 ? baseTexel.xyz : textureLod(probeVolumeValidity, (probeGrid + 0.5) / probeVolumeCount, 0.0).xyz;
            probeOffset = (encoded * 255.0 - 128.0) / 254.0;
        }
        vec3 probePosition = probeVolumeMin + (probeGrid + 0.5 + probeOffset) * probeVolumeCellSize;
        vec3 toProbe = probePosition - litArgs_worldPosition;
        float facing = (dot(toProbe, worldNormal) * inversesqrt(max(dot(toProbe, toProbe), 1e-8)) + 1.0) * 0.5;
        float valid = float((validity >> i) & 1);
        float probeWeight = mix(1.0, valid * (facing * facing + 0.2), leakReduction);

        // the visibility of the probe from the position, with the small weights crushed, as a
        // little light is still visible due to the logarithmic perception (DDGI)
        if (probeVolumeVisibilityParams.x > 0.0 && weight > 0.0) {
            float probe = probeGrid.x + probeVolumeCount.x * (probeGrid.y + probeVolumeCount.y * probeGrid.z);
            probeWeight *= getProbeVolumeVisibility(probe, position - probePosition);
            if (probeWeight < 0.2) {
                probeWeight *= probeWeight * probeWeight * 25.0;
            }
        }

        weight *= probeWeight;
        center += corner * weight;
        weightSum += weight;
    }

    // the weighted center of the probes, which the hardware filtering approximates the weights at
    return weightSum > 1e-6 ? base + center / weightSum : grid;
}

vec3 getProbeVolumeAmbient(vec3 ambient, vec3 worldNormal) {

    #ifdef PROBE_VOLUME_DEBUG
        // the probe of the cell of the surface, as it is stored
        vec3 grid = floor(clamp((litArgs_worldPosition - probeVolumeMin) * probeVolumeInvSize * probeVolumeCount, vec3(0.0), probeVolumeCount - 1.0));
    #else
        vec3 grid = getProbeVolumeGrid(worldNormal);
    #endif

    // the texture coordinates in the first of the three sub-volumes
    vec3 uvw = (grid + 0.5) / probeVolumeCount;
    uvw.z /= 3.0;
    vec4 r = decodeProbeVolumeTexel(textureLod(probeVolumeTexture, uvw, 0.0));
    vec4 g = decodeProbeVolumeTexel(textureLod(probeVolumeTexture, uvw + vec3(0.0, 0.0, 1.0 / 3.0), 0.0));
    vec4 b = decodeProbeVolumeTexel(textureLod(probeVolumeTexture, uvw + vec3(0.0, 0.0, 2.0 / 3.0), 0.0));

    // the axis of the zonal harmonic, shared by the channels: the direction of the luminance L1
    vec3 axis = r.yzw * 0.2126 + g.yzw * 0.7152 + b.yzw * 0.0722;
    axis *= inversesqrt(max(dot(axis, axis), 1e-12));
    float cosAxis = dot(worldNormal, axis);

    // the zonal basis function along the axis, convolved with the clamped cosine lobe (1/4)
    float zonal = probeVolumeParams.z * 0.25 * 0.315392 * (3.0 * cosAxis * cosAxis - 1.0);

    vec3 irradiance = vec3(
        evaluateProbeVolumeChannel(r, worldNormal, axis, zonal),
        evaluateProbeVolumeChannel(g, worldNormal, axis, zonal),
        evaluateProbeVolumeChannel(b, worldNormal, axis, zonal)
    );
    vec3 probeAmbient = max(irradiance, vec3(0.0)) * probeVolumeParams.y;

    // blend to the ambient of the environment with the distance outside of the volume
    vec3 outside = max(max(probeVolumeMin - litArgs_worldPosition, litArgs_worldPosition - probeVolumeMax), vec3(0.0));
    float weight = clamp(1.0 - length(outside) * probeVolumeBlend.x, 0.0, 1.0) * probeVolumeBlend.y;

    // the reflections of the environment, occluded where the probes are darker than it
    vec3 luminance = vec3(0.2126, 0.7152, 0.0722);
    float occlusion = clamp(dot(probeAmbient, luminance) / max(dot(ambient, luminance), 1e-6), 0.0, 1.0);
    dProbeVolumeReflection = mix(1.0, occlusion, weight * probeVolumeBlend.z);

    return mix(ambient, probeAmbient, weight);
}

vec3 modifyAmbient(vec3 ambient, vec3 worldNormal) {
    return getProbeVolumeAmbient(ambient, worldNormal);
}

float getReflectionOcclusion() {
    return dProbeVolumeReflection;
}

#else

vec3 modifyAmbient(vec3 ambient, vec3 worldNormal) {
    return ambient;
}

float getReflectionOcclusion() {
    return 1.0;
}

#endif
`;

const probeVolumeChunkWGSL = /* wgsl */`
#ifdef PROBE_VOLUME

var probeVolumeTexture: texture_3d<f32>;
var probeVolumeTextureSampler: sampler;

// for each probe, in xyz, its offset from its position in units of its cell, mapped to 1..255, and
// in w, the validity of the eight probes of the cell it is the first corner of, as bits
var probeVolumeValidity: texture_3d<f32>;
var probeVolumeValiditySampler: sampler;

// the box of the volume, and the inverse of its size
uniform probeVolumeMin: vec3f;
uniform probeVolumeMax: vec3f;
uniform probeVolumeInvSize: vec3f;

// the number of probes along each axis, and the size of their cells
uniform probeVolumeCount: vec3f;
uniform probeVolumeCellSize: vec3f;

// x: normal bias, y: intensity, z: SH sharpening weight, w: leak reduction weight
uniform probeVolumeParams: vec4f;

// x: inverse of the distance over which the volume blends to the environment, y: blend weight,
// z: reflection occlusion weight
uniform probeVolumeBlend: vec3f;

// x: 1 for 8-bit texels, 0 for half float texels, y: the scale of L0 of 8-bit texels
uniform probeVolumeEncoding: vec2f;

// the atlas of the octahedral maps of the visibility of the probes, in tiles with a border of one
// texel, each texel holding the mean and the mean squared distance to the closest surface
var probeVolumeVisibility: texture_2d<f32>;
var probeVolumeVisibilitySampler: sampler;

// x: 1 to use the visibility, 0 to not, y: tiles along a row of the atlas, z: texels along a side
// of a map
uniform probeVolumeVisibilityParams: vec4f;

// the inverse of the size of the atlas
uniform probeVolumeVisibilityInvSize: vec2f;

// the scale of the reflections of the environment, set by getProbeVolumeAmbient
var<private> dProbeVolumeReflection: f32 = 1.0;

// returns the L0 and L1 coefficients of a channel. Half float texels store them as they are, and
// 8-bit texels store sqrt(L0 / scale) and L1 / (sqrt(3) * L0) mapped to 0..1
fn decodeProbeVolumeTexel(texel: vec4f) -> vec4f {
    let encoded = uniform.probeVolumeEncoding.x;
    let l0 = texel.x * mix(1.0, texel.x * uniform.probeVolumeEncoding.y, encoded);
    let l1 = mix(texel.yzw, (texel.yzw * 2.0 - 1.0) * (1.7320508 * l0), vec3f(encoded));
    return vec4f(l0, l1);
}

// the irradiance divided by pi of a channel, from the radiance SH of the channel
fn evaluateProbeVolumeChannel(sh: vec4f, normal: vec3f, axis: vec3f, zonal: f32) -> f32 {

    // L0 and L1 convolved with the clamped cosine lobe, band factors 1 and 2/3
    let irradiance = 0.282095 * sh.x + 0.325735 * dot(sh.yzw, normal);

    // a quadratic zonal harmonic along the shared axis, its coefficient estimated from how
    // directional the L1 coefficients are (ZH3, Roughton et al., I3D 2024)
    let ratio = min(abs(dot(sh.yzw, axis)) / max(sh.x, 1e-6), 1.7320508);
    return irradiance + zonal * sh.x * (0.08 * ratio + 0.6 * ratio * ratio);
}

// the octahedral coordinates of a direction, in 0..1 (Cigolle et al., JCGT 2014)
fn probeVolumeOctahedral(dir: vec3f) -> vec2f {
    var p = dir.xy / (abs(dir.x) + abs(dir.y) + abs(dir.z));
    if (dir.z < 0.0) {
        p = (1.0 - abs(p.yx)) * select(vec2f(-1.0), vec2f(1.0), p >= vec2f(0.0));
    }
    return p * 0.5 + 0.5;
}

// the visibility of a probe from a position: the Chebyshev bound of the probability that the probe
// sees the position, from the mean and the variance of the distances it sees in its direction
fn getProbeVolumeVisibility(probe: f32, fromProbe: vec3f) -> f32 {

    // the direction in the map of the probe, inside the border of its tile
    let tilesPerRow = uniform.probeVolumeVisibilityParams.y;
    let size = uniform.probeVolumeVisibilityParams.z;
    let row = floor((probe + 0.5) / tilesPerRow);
    let tile = vec2f(probe - row * tilesPerRow, row);
    let dist = length(fromProbe);
    let octahedral = probeVolumeOctahedral(fromProbe / max(dist, 1e-6));
    let uv = (tile * (size + 2.0) + 1.0 + octahedral * size) * uniform.probeVolumeVisibilityInvSize;
    let moments = textureSampleLevel(probeVolumeVisibility, probeVolumeVisibilitySampler, uv, 0.0).rg;

    if (dist <= moments.x) {
        return 1.0;
    }
    let variance = abs(moments.y - moments.x * moments.x);
    let delta = dist - moments.x;
    let chebyshev = variance / (variance + delta * delta);

    // sharpened, and never zero, so that a position hidden from all probes still has a fallback
    return max(chebyshev * chebyshev * chebyshev, 0.05);
}

// the grid coordinates of the probes to sample at a surface, the probes at whole coordinates
fn getProbeVolumeGrid(worldNormal: vec3f) -> vec3f {

    // sample in front of the surface, so that the probes behind it contribute less
    let position = litArgs_worldPosition + worldNormal * uniform.probeVolumeParams.x;

    // clamped to the probes, so that positions outside of them use the border probes
    let count = uniform.probeVolumeCount;
    let grid = clamp((position - uniform.probeVolumeMin) * uniform.probeVolumeInvSize * count - 0.5, vec3f(0.0), count - 1.0);

    // the weights of the eight probes around the position: trilinear, and to reduce leaking, zero
    // for the invalid probes and smaller for the probes behind the surface
    let base = min(floor(grid), max(count - 2.0, vec3f(0.0)));
    let offset = grid - base;
    let baseTexel = textureSampleLevel(probeVolumeValidity, probeVolumeValiditySampler, (base + 0.5) / count, 0.0);
    let validity = u32(baseTexel.w * 255.0 + 0.5);
    let leakReduction = uniform.probeVolumeParams.w;
    let useOffsets = leakReduction > 0.0 || uniform.probeVolumeVisibilityParams.x > 0.0;

    var center = vec3f(0.0);
    var weightSum = 0.0;
    for (var i = 0u; i < 8u; i++) {
        let corner = vec3f(f32(i & 1u), f32((i >> 1u) & 1u), f32((i >> 2u) & 1u));
        let trilinear = mix(1.0 - offset, offset, corner);
        var weight = trilinear.x * trilinear.y * trilinear.z;

        // the position the probe was captured at, and the direction to it from the surface
        // (Majercik et al., DDGI)
        let probeGrid = base + corner;
        var probeOffset = vec3f(0.0);
        if (useOffsets) {
            var encoded = baseTexel.xyz;
            if (i > 0u) {
                encoded = textureSampleLevel(probeVolumeValidity, probeVolumeValiditySampler, (probeGrid + 0.5) / count, 0.0).xyz;
            }
            probeOffset = (encoded * 255.0 - 128.0) / 254.0;
        }
        let probePosition = uniform.probeVolumeMin + (probeGrid + 0.5 + probeOffset) * uniform.probeVolumeCellSize;
        let toProbe = probePosition - litArgs_worldPosition;
        let facing = (dot(toProbe, worldNormal) * inverseSqrt(max(dot(toProbe, toProbe), 1e-8)) + 1.0) * 0.5;
        let valid = f32((validity >> i) & 1u);
        var probeWeight = mix(1.0, valid * (facing * facing + 0.2), leakReduction);

        // the visibility of the probe from the position, with the small weights crushed, as a
        // little light is still visible due to the logarithmic perception (DDGI)
        if (uniform.probeVolumeVisibilityParams.x > 0.0 && weight > 0.0) {
            let probe = probeGrid.x + count.x * (probeGrid.y + count.y * probeGrid.z);
            probeWeight *= getProbeVolumeVisibility(probe, position - probePosition);
            if (probeWeight < 0.2) {
                probeWeight *= probeWeight * probeWeight * 25.0;
            }
        }

        weight *= probeWeight;
        center += corner * weight;
        weightSum += weight;
    }

    // the weighted center of the probes, which the hardware filtering approximates the weights at
    return select(grid, base + center / weightSum, weightSum > 1e-6);
}

fn getProbeVolumeAmbient(ambient: vec3f, worldNormal: vec3f) -> vec3f {

    let count = uniform.probeVolumeCount;

    #ifdef PROBE_VOLUME_DEBUG
        // the probe of the cell of the surface, as it is stored
        let grid = floor(clamp((litArgs_worldPosition - uniform.probeVolumeMin) * uniform.probeVolumeInvSize * count, vec3f(0.0), count - 1.0));
    #else
        let grid = getProbeVolumeGrid(worldNormal);
    #endif

    // the texture coordinates in the first of the three sub-volumes
    var uvw = (grid + 0.5) / count;
    uvw.z /= 3.0;
    let r = decodeProbeVolumeTexel(textureSampleLevel(probeVolumeTexture, probeVolumeTextureSampler, uvw, 0.0));
    let g = decodeProbeVolumeTexel(textureSampleLevel(probeVolumeTexture, probeVolumeTextureSampler, uvw + vec3f(0.0, 0.0, 1.0 / 3.0), 0.0));
    let b = decodeProbeVolumeTexel(textureSampleLevel(probeVolumeTexture, probeVolumeTextureSampler, uvw + vec3f(0.0, 0.0, 2.0 / 3.0), 0.0));

    // the axis of the zonal harmonic, shared by the channels: the direction of the luminance L1
    var axis = r.yzw * 0.2126 + g.yzw * 0.7152 + b.yzw * 0.0722;
    axis *= inverseSqrt(max(dot(axis, axis), 1e-12));
    let cosAxis = dot(worldNormal, axis);

    // the zonal basis function along the axis, convolved with the clamped cosine lobe (1/4)
    let zonal = uniform.probeVolumeParams.z * 0.25 * 0.315392 * (3.0 * cosAxis * cosAxis - 1.0);

    let irradiance = vec3f(
        evaluateProbeVolumeChannel(r, worldNormal, axis, zonal),
        evaluateProbeVolumeChannel(g, worldNormal, axis, zonal),
        evaluateProbeVolumeChannel(b, worldNormal, axis, zonal)
    );
    let probeAmbient = max(irradiance, vec3f(0.0)) * uniform.probeVolumeParams.y;

    // blend to the ambient of the environment with the distance outside of the volume
    let outside = max(max(uniform.probeVolumeMin - litArgs_worldPosition, litArgs_worldPosition - uniform.probeVolumeMax), vec3f(0.0));
    let weight = clamp(1.0 - length(outside) * uniform.probeVolumeBlend.x, 0.0, 1.0) * uniform.probeVolumeBlend.y;

    // the reflections of the environment, occluded where the probes are darker than it
    let luminance = vec3f(0.2126, 0.7152, 0.0722);
    let occlusion = saturate(dot(probeAmbient, luminance) / max(dot(ambient, luminance), 1e-6));
    dProbeVolumeReflection = mix(1.0, occlusion, weight * uniform.probeVolumeBlend.z);

    return mix(ambient, probeAmbient, vec3f(weight));
}

fn modifyAmbient(ambient: vec3f, worldNormal: vec3f) -> vec3f {
    return getProbeVolumeAmbient(ambient, worldNormal);
}

fn getReflectionOcclusion() -> f32 {
    return dProbeVolumeReflection;
}

#else

fn modifyAmbient(ambient: vec3f, worldNormal: vec3f) -> vec3f {
    return ambient;
}

fn getReflectionOcclusion() -> f32 {
    return 1.0;
}

#endif
`;

export { probeVolumeChunkGLSL, probeVolumeChunkWGSL };
