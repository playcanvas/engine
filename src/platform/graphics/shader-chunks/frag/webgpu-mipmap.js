// Shader used by WebgpuMipmapRenderer to generate texture mipmaps, by rendering the previous mip
// level into the next one using a fullscreen quad.
export default /* wgsl */`

    var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
        vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0)
    );

    struct VertexOutput {
        @builtin(position) position : vec4f,
        @location(0) texCoord : vec2f
    };

    @vertex
    fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
        var output : VertexOutput;
        output.texCoord = pos[vertexIndex] * vec2f(0.5, -0.5) + vec2f(0.5);
        output.position = vec4f(pos[vertexIndex], 0, 1);
        return output;
    }

    @group(0) @binding(0) var imgSampler : sampler;
    @group(0) @binding(1) var img : texture_2d<f32>;

    @fragment
    fn fragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {
        return textureSample(img, imgSampler, texCoord);
    }
`;
