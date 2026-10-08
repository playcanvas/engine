// Shader used by WebgpuMipmapRenderer to generate texture mipmaps, by rendering the previous mip
// level into the next one using a fullscreen quad. With UNFILTERABLE defined, for formats which
// cannot be filtered, such as 32-bit float formats on devices without float32-filterable support,
// each texel is instead the average of the 2x2 texels of the previous mip level it covers, read
// without a sampler.
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

    #ifdef UNFILTERABLE
        @group(0) @binding(0) var img : texture_2d<f32>;
    #else
        @group(0) @binding(0) var imgSampler : sampler;
        @group(0) @binding(1) var img : texture_2d<f32>;
    #endif

    @fragment
    fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
        #ifdef UNFILTERABLE
            let base = vec2i(input.position.xy) * 2;
            let last = vec2i(textureDimensions(img)) - 1;
            var sum = vec4f(0.0);
            for (var y = 0; y < 2; y++) {
                for (var x = 0; x < 2; x++) {
                    sum += textureLoad(img, min(base + vec2i(x, y), last), 0);
                }
            }
            return sum * 0.25;
        #else
            return textureSample(img, imgSampler, input.texCoord);
        #endif
    }
`;
