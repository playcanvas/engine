export default /* wgsl */`
var sh_labels: texture_2d<f32>;
var sh_centroids: texture_2d<f32>;

uniform shN_mins: f32;
uniform shN_maxs: f32;

fn readSHData(source: ptr<function, SplatSource>, sh: ptr<function, array<vec3f, 15>>, scale: ptr<function, f32>) {
    // extract spherical harmonics palette index
    let t: vec2<i32> = vec2<i32>(textureLoad(sh_labels, source.uv, 0).xy * 255.0);
    let n: i32 = t.x + t.y * 256;
    let u: i32 = (n % 64) * 15;
    let v: i32 = n / 64;

    // calculate offset into the centroids texture and read 15 consecutive texels
    for (var i: i32 = 0; i < 15; i = i + 1) {
        sh[i] = mix(vec3f(shN_mins), vec3f(shN_maxs), textureLoad(sh_centroids, vec2<i32>(u + i, v), 0).xyz);
    }

    *scale = 1.0;
}
`;
