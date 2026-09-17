// Shader used by WebgpuResolver to resolve a multisampled depth texture into a single-sampled
// texture, by rendering a fullscreen quad. The resolve mode is selected by exactly one of these
// defines: DEPTH_RESOLVE_SAMPLE0, DEPTH_RESOLVE_MIN or DEPTH_RESOLVE_MAX.
export default /* wgsl */`

    var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
        vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0)
    );

    struct VertexOutput {
        @builtin(position) position : vec4f,
    };

    @vertex
    fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
        var output : VertexOutput;
        output.position = vec4f(pos[vertexIndex], 0, 1);
        return output;
    }

    @group(0) @binding(0) var img : texture_depth_multisampled_2d;

    @fragment
    fn fragmentMain(@builtin(position) fragColor: vec4f) -> @location(0) vec4f {
        let coord = vec2i(fragColor.xy);

        // the depth value of sample 0, or a min/max reduction of all samples
        var depth = textureLoad(img, coord, 0u);
        #if defined(DEPTH_RESOLVE_MIN) || defined(DEPTH_RESOLVE_MAX)
            let count = i32(textureNumSamples(img));
            for (var i = 1; i < count; i++) {
                #ifdef DEPTH_RESOLVE_MIN
                    depth = min(depth, textureLoad(img, coord, i));
                #else
                    depth = max(depth, textureLoad(img, coord, i));
                #endif
            }
        #endif

        return vec4f(depth, 0.0, 0.0, 0.0);
    }
`;
