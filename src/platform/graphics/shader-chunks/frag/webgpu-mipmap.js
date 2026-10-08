// Shader used by WebgpuMipmapRenderer to generate texture mipmaps, by rendering the previous mip
// level into the next one using a fullscreen quad. With UNFILTERABLE defined, for formats which
// cannot be filtered, such as 32-bit float formats on devices without float32-filterable support,
// the texels of the previous mip level are read without a sampler and filtered in the shader, at
// the same position as the sampler would.
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

        fn texel(x : i32, y : i32) -> vec4f {
            return textureLoad(img, vec2i(x, y), 0);
        }
    #else
        @group(0) @binding(0) var imgSampler : sampler;
        @group(0) @binding(1) var img : texture_2d<f32>;
    #endif

    @fragment
    fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
        #ifdef UNFILTERABLE
            // the position the sampler samples at, in the texels of the previous mip level, which
            // for an odd size is not at the corner of two texels
            let srcSize = vec2f(textureDimensions(img));
            let dstSize = max(vec2f(1.0), floor(srcSize * 0.5));
            let pos = input.position.xy * srcSize / dstSize - 0.5;

            // bilinear filtering of the 2x2 texels around it
            let base = floor(pos);
            let f = pos - base;
            let i0 = vec2i(base);
            let i1 = min(i0 + 1, vec2i(srcSize) - 1);
            return mix(
                mix(texel(i0.x, i0.y), texel(i1.x, i0.y), f.x),
                mix(texel(i0.x, i1.y), texel(i1.x, i1.y), f.x),
                f.y
            );
        #else
            return textureSample(img, imgSampler, input.texCoord);
        #endif
    }
`;
