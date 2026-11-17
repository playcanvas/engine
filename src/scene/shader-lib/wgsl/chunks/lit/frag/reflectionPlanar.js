// Reflections sampled from a planar reflection texture: the scene rendered by a camera mirrored by
// the plane, with the view projection matrix of that camera.
export default /* wgsl */`
var texture_planarReflectionMap: texture_2d<f32>;
var texture_planarReflectionMapSampler: sampler;
uniform planarReflectionMatrix: mat4x4f;
uniform material_reflectivity: f32;

// The weights of the cubic B-spline of the four texels around a sample position.
fn planarCubicWeights(v: f32) -> vec4f {
    let n = vec4f(1.0, 2.0, 3.0, 4.0) - v;
    let s = n * n * n;
    let x = s.x;
    let y = s.y - 4.0 * s.x;
    let z = s.z - 4.0 * s.y + 6.0 * s.x;
    return vec4f(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
}

// A mip level of the reflection, filtered by a bicubic B-spline from four bilinear taps. Where a
// small mip level covers many pixels, this is smooth, while the bilinear filtering shows its texels.
fn samplePlanarBicubic(uv: vec2f, level: f32) -> vec3f {
    let size = vec2f(textureDimensions(texture_planarReflectionMap, i32(level)));
    let coord = uv * size - 0.5;
    let f = fract(coord);
    let texel = coord - f;

    let wx = planarCubicWeights(f.x);
    let wy = planarCubicWeights(f.y);
    let c = texel.xxyy + vec4f(-0.5, 1.5, -0.5, 1.5);
    let s = vec4f(wx.xz + wx.yw, wy.xz + wy.yw);
    let offset = (c + vec4f(wx.yw, wy.yw) / s) / size.xxyy;

    let s0 = {reflectionDecode}(textureSampleLevel(texture_planarReflectionMap, texture_planarReflectionMapSampler, offset.xz, level));
    let s1 = {reflectionDecode}(textureSampleLevel(texture_planarReflectionMap, texture_planarReflectionMapSampler, offset.yz, level));
    let s2 = {reflectionDecode}(textureSampleLevel(texture_planarReflectionMap, texture_planarReflectionMapSampler, offset.xw, level));
    let s3 = {reflectionDecode}(textureSampleLevel(texture_planarReflectionMap, texture_planarReflectionMapSampler, offset.yw, level));

    let sx = s.x / (s.x + s.y);
    let sy = s.z / (s.z + s.w);
    return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

fn calcReflection(reflDir: vec3f, gloss: f32) -> vec3f {

    // Project a point a short distance along the reflected ray into the texture. For a surface
    // lying on the plane, this is the pixel the surface itself projects to. A normal tilted away
    // from the plane, by a normal map or a bevel, moves the point, distorting the reflection.
    let clipPos = uniform.planarReflectionMatrix * vec4f(litArgs_worldPosition + reflDir * 0.2, 1.0);
    let uv = getGrabScreenPos(clipPos);

    // rougher surfaces sample the smaller mipmaps of the texture, blurring the reflection, up to
    // the last mip level it has
    let width = f32(textureDimensions(texture_planarReflectionMap, 0).x);
    let maxLevel = f32(textureNumLevels(texture_planarReflectionMap) - 1u);
    let lod = min((1.0 - gloss) * log2(width), maxLevel);
    let level = floor(lod);

    // the top level is sampled bilinearly, which keeps a mirror sharp, and the blurred levels by
    // the bicubic B-spline, blending the two levels around the level of detail
    var reflection: vec3f;
    if (level < 1.0) {
        reflection = {reflectionDecode}(textureSampleLevel(texture_planarReflectionMap, texture_planarReflectionMapSampler, uv, 0.0));
    } else {
        reflection = samplePlanarBicubic(uv, level);
    }
    if (lod > level) {
        reflection = mix(reflection, samplePlanarBicubic(uv, level + 1.0), lod - level);
    }
    return reflection;
}

fn addReflection(reflDir: vec3f, gloss: f32) {
    dReflection = dReflection + vec4f(calcReflection(reflDir, gloss), uniform.material_reflectivity);
}
`;
