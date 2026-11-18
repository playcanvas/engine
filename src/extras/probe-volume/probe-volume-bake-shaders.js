// The shaders of the probe volume baker.
//
// The probes capture into atlases of tiles: each probe a block of 3 x 2 square faces of the size
// probeAtlasParams.x, in rows of probeAtlasParams.y probes. The texel (x, y) of a face, counted from
// its bottom left corner, sees along cubemapFaceDirection(face, u, v), with u and v its center in
// -1..1. probeAtlasParams.w is 1 when the rows of the atlas textures are stored in the opposite order
// to the rows of the viewports the cameras render the tiles with.
//
// The projection shader integrates the tiles of the probes of a row of its render target, the probes
// from probeRowStart, probeLayoutParams.x texels each. By default, it projects the radiance of the
// tiles onto L1 spherical harmonics, writing three texels for a probe: the L0 and the three L1
// coefficients of the red, green and blue channels. With the VALIDITY define, it integrates the
// geometry of the tiles into a texel: the fraction of the sphere covered by back faces, and the vector
// to the closest back face. With the VISIBILITY define, it filters the distances of the tiles into
// an octahedral map of the probe, a texel for each of its directions: the mean and the mean squared
// distance to the closest surface around the direction.

// the directions through the faces of the cameras capturing the probes, see faceRotations
const faceDirectionGLSL = /* glsl */`
vec3 cubemapFaceDirection(int face, float u, float v) {
    if (face == 0) return vec3(-1.0, v, -u);
    if (face == 1) return vec3(1.0, v, u);
    if (face == 2) return vec3(-u, 1.0, -v);
    if (face == 3) return vec3(-u, -1.0, v);
    if (face == 4) return vec3(-u, v, 1.0);
    return vec3(u, v, -1.0);
}

// the texel of an atlas holding the texel (x, y) of a face of the tile at the origin
ivec2 probeAtlasTexel(vec4 atlasParams, ivec2 origin, int face, int x, int y) {
    int size = int(atlasParams.x);
    ivec2 texel = origin + ivec2((face % 3) * size + x, (face / 3) * size + y);
    if (atlasParams.w > 0.5) {
        texel.y = int(atlasParams.z) - 1 - texel.y;
    }
    return texel;
}

// the viewport origin of the tile of a probe
ivec2 probeTileOrigin(vec4 atlasParams, int probe) {
    int size = int(atlasParams.x);
    int perRow = int(atlasParams.y);
    return ivec2((probe % perRow) * size * 3, (probe / perRow) * size * 2);
}
`;

const faceDirectionWGSL = /* wgsl */`
fn cubemapFaceDirection(face: i32, u: f32, v: f32) -> vec3f {
    switch (face) {
        case 0: { return vec3f(-1.0, v, -u); }
        case 1: { return vec3f(1.0, v, u); }
        case 2: { return vec3f(-u, 1.0, -v); }
        case 3: { return vec3f(-u, -1.0, v); }
        case 4: { return vec3f(-u, v, 1.0); }
        default: { return vec3f(u, v, -1.0); }
    }
}

// the texel of an atlas holding the texel (x, y) of a face of the tile at the origin
fn probeAtlasTexel(atlasParams: vec4f, origin: vec2i, face: i32, x: i32, y: i32) -> vec2i {
    let size = i32(atlasParams.x);
    var texel = origin + vec2i((face % 3) * size + x, (face / 3) * size + y);
    if (atlasParams.w > 0.5) {
        texel.y = i32(atlasParams.z) - 1 - texel.y;
    }
    return texel;
}

// the viewport origin of the tile of a probe
fn probeTileOrigin(atlasParams: vec4f, probe: i32) -> vec2i {
    let size = i32(atlasParams.x);
    let perRow = i32(atlasParams.y);
    return vec2i((probe % perRow) * size * 3, (probe / perRow) * size * 2);
}
`;

const projectShaderGLSL = /* glsl */`

// the radiance of the tiles, or the albedo and hit flag of the geometry
uniform highp sampler2D probeAtlas0;

// the back face flag and the distance of the geometry
uniform highp sampler2D probeAtlas1;

uniform vec4 probeAtlasParams;

// x: the texels of a probe in the render target, y: the number of probes
uniform vec4 probeLayoutParams;
uniform float probeRowStart;

#ifdef VISIBILITY
    // the number of texels along a side of the octahedral maps, and the distance the distances are
    // clamped to
    uniform float probeVisibilitySize;
    uniform float probeVisibilityMaxDistance;

    // the direction of a point of the octahedral map, for coordinates in -1..1 (Cigolle et al.,
    // JCGT 2014)
    vec3 octahedralDirection(vec2 p) {
        vec3 n = vec3(p, 1.0 - abs(p.x) - abs(p.y));
        float t = max(-n.z, 0.0);
        n.x += n.x >= 0.0 ? -t : t;
        n.y += n.y >= 0.0 ? -t : t;
        return normalize(n);
    }
#endif

${faceDirectionGLSL}

void main(void) {

    int texelsPerProbe = int(probeLayoutParams.x);
    int column = int(gl_FragCoord.x);
    int probe = int(probeRowStart) + column / texelsPerProbe;
    int localTexel = column % texelsPerProbe;
    if (probe >= int(probeLayoutParams.y)) {
        gl_FragColor = vec4(0.0);
        return;
    }

    int size = int(probeAtlasParams.x);
    float texelSize = 2.0 / probeAtlasParams.x;
    ivec2 origin = probeTileOrigin(probeAtlasParams, probe);

    vec4 result = vec4(0.0);
    float weightSum = 0.0;
    float closest = 1e10;

    #ifdef VISIBILITY
        // the direction of the texel of the octahedral map
        int mapSize = int(probeVisibilitySize);
        vec2 mapCoords = vec2(float(localTexel % mapSize), float(localTexel / mapSize));
        vec3 mapDir = octahedralDirection((mapCoords + 0.5) / probeVisibilitySize * 2.0 - 1.0);
        float lobeSum = 0.0;
    #endif

    for (int face = 0; face < 6; face++) {

        #ifdef VISIBILITY
            // the lobe is negligible beyond 30 degrees, so the faces whose texels are all further
            // from the direction, beyond the 55 degrees of the corners of a face, are skipped
            if (dot(mapDir, cubemapFaceDirection(face, 0.0, 0.0)) < 0.09) {
                continue;
            }
        #endif

        for (int y = 0; y < size; y++) {
            for (int x = 0; x < size; x++) {
                float u = (float(x) + 0.5) * texelSize - 1.0;
                float v = (float(y) + 0.5) * texelSize - 1.0;

                // the solid angle of the texel, up to a constant factor
                float t = 1.0 + u * u + v * v;
                float weight = 1.0 / (t * sqrt(t));
                weightSum += weight;

                vec3 dir = normalize(cubemapFaceDirection(face, u, v));
                ivec2 texel = probeAtlasTexel(probeAtlasParams, origin, face, x, y);

                #if defined(VALIDITY)
                    // r: 1 for a back face, g: the distance to it
                    vec4 geometry = texelFetch(probeAtlas1, texel, 0);
                    result.x += geometry.r * weight;
                    if (geometry.r > 0.5 && geometry.g < closest) {
                        closest = geometry.g;
                        result.yzw = dir * geometry.g;
                    }
                #elif defined(VISIBILITY)
                    // the distance to the closest surface, the texels without a surface are far,
                    // weighted by a cosine power lobe around the direction (DDGI)
                    float hit = texelFetch(probeAtlas0, texel, 0).a;
                    float distance = texelFetch(probeAtlas1, texel, 0).g;
                    float dist = hit > 0.5 ? min(distance, probeVisibilityMaxDistance) : probeVisibilityMaxDistance;
                    float lobe = weight * pow(max(dot(mapDir, dir), 0.0), 50.0);
                    result.xy += vec2(dist, dist * dist) * lobe;
                    lobeSum += lobe;
                #else
                    // L0 and L1 basis functions
                    vec4 radiance = texelFetch(probeAtlas0, texel, 0);
                    result += radiance[localTexel] * weight * vec4(0.282095, 0.488603 * dir);
                #endif
            }
        }
    }

    #if defined(VALIDITY)
        // the fraction of the sphere covered by back faces
        result.x /= weightSum;
        gl_FragColor = result;
    #elif defined(VISIBILITY)
        // the mean and the mean squared distance
        gl_FragColor = vec4(result.xy / max(lobeSum, 1e-12), 0.0, 1.0);
    #else
        // the weights add up to the solid angle of the sphere, 4 pi
        gl_FragColor = result * (12.566371 / weightSum);
    #endif
}
`;

const projectShaderWGSL = /* wgsl */`

// the radiance of the tiles, or the albedo and hit flag of the geometry
var probeAtlas0: texture_2d<f32>;

// the back face flag and the distance of the geometry
var probeAtlas1: texture_2d<f32>;

uniform probeAtlasParams: vec4f;

// x: the texels of a probe in the render target, y: the number of probes
uniform probeLayoutParams: vec4f;
uniform probeRowStart: f32;

#ifdef VISIBILITY
    // the number of texels along a side of the octahedral maps, and the distance the distances are
    // clamped to
    uniform probeVisibilitySize: f32;
    uniform probeVisibilityMaxDistance: f32;

    // the direction of a point of the octahedral map, for coordinates in -1..1 (Cigolle et al.,
    // JCGT 2014)
    fn octahedralDirection(p: vec2f) -> vec3f {
        var n = vec3f(p, 1.0 - abs(p.x) - abs(p.y));
        let t = max(-n.z, 0.0);
        n.x += select(t, -t, n.x >= 0.0);
        n.y += select(t, -t, n.y >= 0.0);
        return normalize(n);
    }
#endif

${faceDirectionWGSL}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let texelsPerProbe = i32(uniform.probeLayoutParams.x);
    let column = i32(pcPosition.x);
    let probe = i32(uniform.probeRowStart) + column / texelsPerProbe;
    let localTexel = column % texelsPerProbe;
    if (probe >= i32(uniform.probeLayoutParams.y)) {
        output.color = vec4f(0.0);
        return output;
    }

    let atlasParams = uniform.probeAtlasParams;
    let size = i32(atlasParams.x);
    let texelSize = 2.0 / atlasParams.x;
    let origin = probeTileOrigin(atlasParams, probe);

    var result = vec4f(0.0);
    var weightSum = 0.0;
    var closest = 1e10;

    #ifdef VISIBILITY
        // the direction of the texel of the octahedral map
        let mapSize = i32(uniform.probeVisibilitySize);
        let mapCoords = vec2f(f32(localTexel % mapSize), f32(localTexel / mapSize));
        let mapDir = octahedralDirection((mapCoords + 0.5) / uniform.probeVisibilitySize * 2.0 - 1.0);
        var lobeSum = 0.0;
    #endif

    for (var face = 0; face < 6; face++) {

        #ifdef VISIBILITY
            // the lobe is negligible beyond 30 degrees, so the faces whose texels are all further
            // from the direction, beyond the 55 degrees of the corners of a face, are skipped
            if (dot(mapDir, cubemapFaceDirection(face, 0.0, 0.0)) < 0.09) {
                continue;
            }
        #endif

        for (var y = 0; y < size; y++) {
            for (var x = 0; x < size; x++) {
                let u = (f32(x) + 0.5) * texelSize - 1.0;
                let v = (f32(y) + 0.5) * texelSize - 1.0;

                // the solid angle of the texel, up to a constant factor
                let t = 1.0 + u * u + v * v;
                let weight = 1.0 / (t * sqrt(t));
                weightSum += weight;

                let dir = normalize(cubemapFaceDirection(face, u, v));
                let texel = probeAtlasTexel(atlasParams, origin, face, x, y);

                #if defined(VALIDITY)
                    // r: 1 for a back face, g: the distance to it
                    let geometry = textureLoad(probeAtlas1, texel, 0);
                    result.x += geometry.r * weight;
                    if (geometry.r > 0.5 && geometry.g < closest) {
                        closest = geometry.g;
                        result = vec4f(result.x, dir * geometry.g);
                    }
                #elif defined(VISIBILITY)
                    // the distance to the closest surface, the texels without a surface are far,
                    // weighted by a cosine power lobe around the direction (DDGI)
                    let maxDistance = uniform.probeVisibilityMaxDistance;
                    let hit = textureLoad(probeAtlas0, texel, 0).a;
                    let distance = textureLoad(probeAtlas1, texel, 0).g;
                    let dist = select(maxDistance, min(distance, maxDistance), hit > 0.5);
                    let lobe = weight * pow(max(dot(mapDir, dir), 0.0), 50.0);
                    result = vec4f(result.xy + vec2f(dist, dist * dist) * lobe, result.zw);
                    lobeSum += lobe;
                #else
                    // L0 and L1 basis functions
                    let radiance = textureLoad(probeAtlas0, texel, 0);
                    result += radiance[localTexel] * weight * vec4f(0.282095, 0.488603 * dir);
                #endif
            }
        }
    }

    #if defined(VALIDITY)
        // the fraction of the sphere covered by back faces
        output.color = vec4f(result.x / weightSum, result.yzw);
    #elif defined(VISIBILITY)
        // the mean and the mean squared distance
        output.color = vec4f(result.xy / max(lobeSum, 1e-12), 0.0, 1.0);
    #else
        // the weights add up to the solid angle of the sphere, 4 pi
        output.color = result * (12.566371 / weightSum);
    #endif
    return output;
}
`;

// The output chunk of the lit materials, which in the geometry pass of the baker writes the geometry
// the probes see, instead of the lit color: the albedo and a hit flag, the back face flag, the
// distance from the probe and the octahedral normal, and the emission.

const gbufferOutputGLSL = /* glsl */`
#if defined(PROBE_GBUFFER_PASS) || defined(PROBE_GBUFFER_EMISSIVE_PASS)
    {
        vec3 toProbe = view_position - vPositionW;

        // the surfaces seen from behind are inside the geometry
        float backFace = dot(vNormalW, toProbe) < 0.0 ? 1.0 : 0.0;

        // octahedral normal (Cigolle et al., JCGT 2014)
        vec3 n = litArgs_worldNormal / (abs(litArgs_worldNormal.x) + abs(litArgs_worldNormal.y) + abs(litArgs_worldNormal.z));
        vec2 octNormal = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);

        gl_FragColor = vec4(litArgs_albedo, 1.0);
        pcFragColor1 = vec4(backFace, length(toProbe), octNormal);
        #ifdef PROBE_GBUFFER_EMISSIVE_PASS
            pcFragColor2 = vec4(litArgs_emission, 1.0);
        #endif
    }
#endif
`;

const gbufferOutputWGSL = /* wgsl */`
#if defined(PROBE_GBUFFER_PASS) || defined(PROBE_GBUFFER_EMISSIVE_PASS)
    {
        let toProbe = uniform.view_position - vPositionW;

        // the surfaces seen from behind are inside the geometry
        let backFace = select(0.0, 1.0, dot(vNormalW, toProbe) < 0.0);

        // octahedral normal (Cigolle et al., JCGT 2014)
        let worldNormal = litArgs_worldNormal;
        let n = worldNormal / (abs(worldNormal.x) + abs(worldNormal.y) + abs(worldNormal.z));
        let signs = vec2f(select(-1.0, 1.0, n.x >= 0.0), select(-1.0, 1.0, n.y >= 0.0));
        let octNormal = select((1.0 - abs(n.yx)) * signs, n.xy, n.z >= 0.0);

        output.color = vec4f(litArgs_albedo, 1.0);
        output.color1 = vec4f(backFace, length(toProbe), octNormal);
        #ifdef PROBE_GBUFFER_EMISSIVE_PASS
            output.color2 = vec4f(litArgs_emission, 1.0);
        #endif
    }
#endif
`;

// The front end of the material lighting the geometry captured by the probes. A quad covers the
// atlas, and each texel of it is lit as the surface the probe saw through it, by the lighting of the
// engine: its position, normal, albedo and emission come from the geometry atlas. The texels without
// a surface show the sky, the back faces are black.

const lightingFrontendGLSL = /* glsl */`
#include "litShaderCorePS"

uniform highp sampler2D probeGeometry0;
uniform highp sampler2D probeGeometry1;
#ifdef PROBE_GBUFFER_EMISSIVE
    uniform highp sampler2D probeGeometry2;
#endif
uniform samplerCube probeSkyCubemap;
uniform highp sampler2D probePositions;
uniform vec4 probeAtlasParams;

${faceDirectionGLSL}

void evaluateFrontend() {
    litArgs_albedo = vec3(0.0);
    litArgs_emission = vec3(0.0);
    litArgs_opacity = 1.0;
    litArgs_ao = 1.0;
    litArgs_worldNormal = vec3(0.0, 1.0, 0.0);

    #ifdef FORWARD_PASS

        // the probe, face and texel of the fragment, from its viewport position
        int size = int(probeAtlasParams.x);
        ivec2 texel = ivec2(gl_FragCoord.xy);
        int row = probeAtlasParams.w > 0.5 ? int(probeAtlasParams.z) - 1 - texel.y : texel.y;
        int tileX = texel.x / (size * 3);
        int tileY = row / (size * 2);
        int probe = tileY * int(probeAtlasParams.y) + tileX;
        int localX = texel.x - tileX * size * 3;
        int localY = row - tileY * size * 2;
        int face = (localY / size) * 3 + localX / size;
        vec2 uv = (vec2(float(localX % size), float(localY % size)) + 0.5) / probeAtlasParams.x * 2.0 - 1.0;
        vec3 dir = normalize(cubemapFaceDirection(face, uv.x, uv.y));

        int positionsWidth = textureSize(probePositions, 0).x;
        vec3 probePosition = texelFetch(probePositions, ivec2(probe % positionsWidth, probe / positionsWidth), 0).xyz;

        vec4 geometry0 = texelFetch(probeGeometry0, texel, 0);
        vec4 geometry1 = texelFetch(probeGeometry1, texel, 0);
        float distance = geometry1.g;

        if (geometry0.a < 0.5) {
            // the sky, far along the direction; the captured cubemaps are mirrored along x
            litArgs_emission = textureCube(probeSkyCubemap, vec3(-dir.x, dir.y, dir.z)).rgb;
            distance = 1000.0;
            litArgs_worldNormal = -dir;
        } else if (geometry1.r < 0.5) {
            litArgs_albedo = geometry0.rgb;
            vec2 e = geometry1.ba;
            vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
            float t = max(-n.z, 0.0);
            n.x += n.x >= 0.0 ? -t : t;
            n.y += n.y >= 0.0 ? -t : t;
            litArgs_worldNormal = normalize(n);
            #ifdef PROBE_GBUFFER_EMISSIVE
                litArgs_emission = texelFetch(probeGeometry2, texel, 0).rgb;
            #endif
        } else {
            // a back face, black
            litArgs_worldNormal = -dir;
        }

        litArgs_worldPosition = probePosition + dir * distance;
        dVertexNormalW = litArgs_worldNormal;
        dViewDirW = -dir;
        dViewDepth = distance;
    #endif
}
`;

const lightingFrontendWGSL = /* wgsl */`
#include "litShaderCorePS"

var probeGeometry0: texture_2d<f32>;
var probeGeometry1: texture_2d<f32>;
#ifdef PROBE_GBUFFER_EMISSIVE
    var probeGeometry2: texture_2d<f32>;
#endif
var probeSkyCubemap: texture_cube<f32>;
var probeSkyCubemapSampler: sampler;
var probePositions: texture_2d<uff>;
uniform probeAtlasParams: vec4f;

${faceDirectionWGSL}

fn evaluateFrontend() {
    litArgs_albedo = vec3f(0.0);
    litArgs_emission = vec3f(0.0);
    litArgs_opacity = 1.0;
    litArgs_ao = 1.0;
    litArgs_worldNormal = vec3f(0.0, 1.0, 0.0);

    #ifdef FORWARD_PASS

        // the probe, face and texel of the fragment, from its viewport position
        let atlasParams = uniform.probeAtlasParams;
        let size = i32(atlasParams.x);
        let texel = vec2i(pcPosition.xy);
        let row = select(texel.y, i32(atlasParams.z) - 1 - texel.y, atlasParams.w > 0.5);
        let tileX = texel.x / (size * 3);
        let tileY = row / (size * 2);
        let probe = tileY * i32(atlasParams.y) + tileX;
        let localX = texel.x - tileX * size * 3;
        let localY = row - tileY * size * 2;
        let face = (localY / size) * 3 + localX / size;
        let uv = (vec2f(f32(localX % size), f32(localY % size)) + 0.5) / atlasParams.x * 2.0 - 1.0;
        let dir = normalize(cubemapFaceDirection(face, uv.x, uv.y));

        let positionsWidth = i32(textureDimensions(probePositions, 0).x);
        let probePosition = textureLoad(probePositions, vec2i(probe % positionsWidth, probe / positionsWidth), 0).xyz;

        let geometry0 = textureLoad(probeGeometry0, texel, 0);
        let geometry1 = textureLoad(probeGeometry1, texel, 0);
        var distance = geometry1.g;

        if (geometry0.a < 0.5) {
            // the sky, far along the direction; the captured cubemaps are mirrored along x
            litArgs_emission = textureSampleLevel(probeSkyCubemap, probeSkyCubemapSampler, vec3f(-dir.x, dir.y, dir.z), 0.0).rgb;
            distance = 1000.0;
            litArgs_worldNormal = -dir;
        } else if (geometry1.r < 0.5) {
            litArgs_albedo = geometry0.rgb;
            let e = geometry1.ba;
            var n = vec3f(e, 1.0 - abs(e.x) - abs(e.y));
            let t = max(-n.z, 0.0);
            n.x += select(t, -t, n.x >= 0.0);
            n.y += select(t, -t, n.y >= 0.0);
            litArgs_worldNormal = normalize(n);
            #ifdef PROBE_GBUFFER_EMISSIVE
                litArgs_emission = textureLoad(probeGeometry2, texel, 0).rgb;
            #endif
        } else {
            // a back face, black
            litArgs_worldNormal = -dir;
        }

        litArgs_worldPosition = probePosition + dir * distance;
        dVertexNormalW = litArgs_worldNormal;
        dViewDirW = -dir;
        dViewDepth = distance;
    #endif
}
`;

// The vertex transform of the quad lighting the geometry: it covers the viewport, at any camera.

const lightingTransformGLSL = /* glsl */`
vec4 getPosition() {
    dModelMatrix = getModelMatrix();
    dPositionW = vec3(0.0);
    return vec4(vertex_position.xy, 0.5, 1.0);
}

vec3 getWorldPosition() {
    return dPositionW;
}
`;

const lightingTransformWGSL = /* wgsl */`
fn getPosition() -> vec4f {
    dModelMatrix = getModelMatrix();
    dPositionW = vec3f(0.0);
    return vec4f(vertex_position.xy, 0.5, 1.0);
}

fn getWorldPosition() -> vec3f {
    return dPositionW;
}
`;

export {
    projectShaderGLSL, projectShaderWGSL,
    gbufferOutputGLSL, gbufferOutputWGSL,
    lightingFrontendGLSL, lightingFrontendWGSL,
    lightingTransformGLSL, lightingTransformWGSL
};
