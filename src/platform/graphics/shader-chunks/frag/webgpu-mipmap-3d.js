// Shader used by WebgpuMipmapRenderer to generate the mipmaps of volume textures, by rendering the
// previous mip level into each depth slice of the next one using a fullscreen quad. The depth slice
// rendered to is the instance index of the draw. With UNFILTERABLE defined, for formats which cannot
// be filtered, such as 32-bit float formats on devices without float32-filterable support, the
// texels of the previous mip level are read without a sampler and filtered in the shader, at the
// same position as the sampler would.
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

        fn texel(x : i32, y : i32, z : i32) -> vec4f {
            return textureLoad(img, vec3i(x, y, z), 0);
        }
    #else
        @group(0) @binding(0) var imgSampler : sampler;
        @group(0) @binding(1) var img : texture_3d<f32>;
    #endif

    @fragment
    fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
        #ifdef UNFILTERABLE
            // the position the sampler samples at, in the texels of the previous mip level, which
            // for an odd size is not at the corner of two texels
            let srcSize = vec3f(textureDimensions(img));
            let dstSize = max(vec3f(1.0), floor(srcSize * 0.5));
            let pos = vec3f(input.position.xy, f32(input.slice) + 0.5) * srcSize / dstSize - 0.5;

            // trilinear filtering of the 2x2x2 texels around it
            let base = floor(pos);
            let f = pos - base;
            let i0 = vec3i(base);
            let i1 = min(i0 + 1, vec3i(srcSize) - 1);
            let slice0 = mix(
                mix(texel(i0.x, i0.y, i0.z), texel(i1.x, i0.y, i0.z), f.x),
                mix(texel(i0.x, i1.y, i0.z), texel(i1.x, i1.y, i0.z), f.x),
                f.y
            );
            let slice1 = mix(
                mix(texel(i0.x, i0.y, i1.z), texel(i1.x, i0.y, i1.z), f.x),
                mix(texel(i0.x, i1.y, i1.z), texel(i1.x, i1.y, i1.z), f.x),
                f.y
            );
            return mix(slice0, slice1, f.z);
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
