// Shader used by WebgpuMipmapRenderer to generate the mipmaps of volume textures, by rendering the
// previous mip level into each depth slice of the next one using a fullscreen quad. The depth slice
// rendered to is the instance index of the draw. With UNFILTERABLE defined, for formats which cannot
// be filtered, such as 32-bit float formats on devices without float32-filterable support, each
// texel is instead the average of the 2x2x2 texels of the previous mip level it covers, read without
// a sampler.
export default /* wgsl */`

    var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
        vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0)
    );

    struct VertexOutput {
        @builtin(position) position : vec4f,
        @location(0) texCoord : vec2f,
        @location(1) @interpolate(flat) slice : u32
    };

    @vertex
    fn vertexMain(@builtin(vertex_index) vertexIndex : u32, @builtin(instance_index) instanceIndex : u32) -> VertexOutput {
        var output : VertexOutput;
        output.texCoord = pos[vertexIndex] * vec2f(0.5, -0.5) + vec2f(0.5);
        output.position = vec4f(pos[vertexIndex], 0, 1);
        output.slice = instanceIndex;
        return output;
    }

    #ifdef UNFILTERABLE
        @group(0) @binding(0) var img : texture_3d<f32>;
    #else
        @group(0) @binding(0) var imgSampler : sampler;
        @group(0) @binding(1) var img : texture_3d<f32>;
    #endif

    @fragment
    fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
        #ifdef UNFILTERABLE
            let base = vec3i(vec2i(input.position.xy), i32(input.slice)) * 2;
            let last = vec3i(textureDimensions(img)) - 1;
            var sum = vec4f(0.0);
            for (var z = 0; z < 2; z++) {
                for (var y = 0; y < 2; y++) {
                    for (var x = 0; x < 2; x++) {
                        sum += textureLoad(img, min(base + vec3i(x, y, z), last), 0);
                    }
                }
            }
            return sum * 0.125;
        #else
            // the center of the destination depth slice, in the normalized coordinates shared by
            // all mip levels - the linear filtering then averages the two source slices it lies
            // between
            let sourceDepth = f32(textureDimensions(img).z);
            let destDepth = max(1.0, floor(sourceDepth * 0.5));
            let w = (f32(input.slice) + 0.5) / destDepth;

            return textureSampleLevel(img, imgSampler, vec3f(input.texCoord, w), 0.0);
        #endif
    }
`;
