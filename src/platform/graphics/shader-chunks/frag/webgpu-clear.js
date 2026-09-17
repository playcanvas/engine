// Shader used by WebgpuClearRenderer to clear the color and / or depth of the viewport area, by
// rendering a fullscreen quad.
export default /* wgsl */`

    struct ub_mesh {
        color : vec4f,
        depth: f32
    }

    @group(2) @binding(0) var<uniform> ubMesh : ub_mesh;

    var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
        vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0)
    );

    struct VertexOutput {
        @builtin(position) position : vec4f
    }

    @vertex
    fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
        var output : VertexOutput;
        output.position = vec4(pos[vertexIndex], ubMesh.depth, 1.0);
        return output;
    }

    @fragment
    fn fragmentMain() -> @location(0) vec4f {
        return ubMesh.color;
    }
`;
