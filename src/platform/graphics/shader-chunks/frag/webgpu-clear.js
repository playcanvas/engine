// Shader used by WebgpuClearRenderer to clear the color, depth and / or stencil of the viewport
// area, by rendering a fullscreen quad. The stencil is written by the stencil state, not the shader.
import { BINDGROUP_MESH_UB } from '../../constants.js';

export default /* wgsl */`

    struct ub_mesh {
        color : vec4f,
        depth: f32
    }

    @group(${BINDGROUP_MESH_UB}) @binding(0) var<uniform> ubMesh : ub_mesh;

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

    // the clear color is written to all color attachments of a multiple render target, as each
    // attachment needs an output; the outputs without an attachment are ignored
    struct FragmentOutput {
        @location(0) color0 : vec4f,
        @location(1) color1 : vec4f,
        @location(2) color2 : vec4f,
        @location(3) color3 : vec4f,
        @location(4) color4 : vec4f,
        @location(5) color5 : vec4f,
        @location(6) color6 : vec4f,
        @location(7) color7 : vec4f
    }

    @fragment
    fn fragmentMain() -> FragmentOutput {
        let color = ubMesh.color;
        return FragmentOutput(color, color, color, color, color, color, color, color);
    }
`;
