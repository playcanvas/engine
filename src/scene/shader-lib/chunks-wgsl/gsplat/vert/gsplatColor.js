export default /* wgsl */`

var splatColor: texture_2d<f32>;

fn readColor(source: ptr<function, SplatSource>) -> vec4f {
    return textureLoad(splatColor, source.uv, 0);
}
`;
