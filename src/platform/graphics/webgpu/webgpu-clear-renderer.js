import { Debug } from "../../../core/debug.js";
import { UniformBufferFormat, UniformFormat } from "../uniform-buffer-format.js";
import { BlendState } from "../blend-state.js";
import {
    CULLFACE_NONE,
    PRIMITIVE_TRISTRIP, SHADERLANGUAGE_WGSL,
    UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC4, BINDGROUP_MESH, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL,
    BINDGROUP_MESH_UB
} from "../constants.js";
import { Shader } from "../shader.js";
import { DynamicBindGroup } from "../bind-group.js";
import { UniformBuffer } from "../uniform-buffer.js";
import { DebugGraphics } from "../debug-graphics.js";
import { DepthState } from "../depth-state.js";

const primitive = {
    type: PRIMITIVE_TRISTRIP,
    base: 0,
    count: 4,
    indexed: false
};

/**
 * A WebGPU helper class implementing a viewport clear operation. When rendering to a texture,
 * the whole surface can be cleared using loadOp, but if only a viewport needs to be cleared, or if
 * it needs to be cleared later during the rendering, this need to be archieved by rendering a quad.
 * This class renders a full-screen quad, and expects the viewport / scissor to be set up to clip
 * it to only required area.
 *
 * @ignore
 */
class WebgpuClearRenderer {
    constructor(device) {

        // shader that can write out color and depth values
        const code = `

            struct ub_mesh {
                color : vec4f,
                depth: f32
            }

            @group(2) @binding(0) var<uniform> ubMesh : ub_mesh;

            var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
                vec2(-1.0, 1.0), vec2(1.0, 1.0),
                vec2(-1.0, -1.0), vec2(1.0, -1.0)
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

        this.shader = new Shader(device, {
            name: 'WebGPUClearRendererShader',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            vshader: code,
            fshader: code
        });

        // uniforms
        this.uniformBuffer = new UniformBuffer(device, new UniformBufferFormat(device, [
            new UniformFormat('color', UNIFORMTYPE_VEC4),
            new UniformFormat('depth', UNIFORMTYPE_FLOAT)
        ]), false);

        this.dynamicBindGroup = new DynamicBindGroup();

        // uniform data
        this.colorData = new Float32Array(4);
    }

    destroy() {
        this.shader.destroy();
        this.shader = null;

        this.uniformBuffer.destroy();
        this.uniformBuffer = null;
    }

    clear(device, renderTarget, options, defaultOptions) {
        options = options || defaultOptions;

        const flags = options.flags ?? defaultOptions.flags;
        if (flags !== 0) {

            DebugGraphics.pushGpuMarker(device, 'CLEAR-RENDERER');

            // dynamic bind group for the UB
            const { uniformBuffer, dynamicBindGroup } = this;
            uniformBuffer.startUpdate(dynamicBindGroup);
            device.setBindGroup(BINDGROUP_MESH_UB, dynamicBindGroup.bindGroup, dynamicBindGroup.offsets);

            // not using mesh bind group
            device.setBindGroup(BINDGROUP_MESH, device.emptyBindGroup);

            // setup clear color
            if ((flags & CLEARFLAG_COLOR) && (renderTarget.colorBuffer || renderTarget.impl.assignedColorTexture)) {
                const color = options.color ?? defaultOptions.color;
                this.colorData.set(color);

                device.setBlendState(BlendState.NOBLEND);
            } else {
                device.setBlendState(BlendState.NOWRITE);
            }
            uniformBuffer.set('color', this.colorData);

            // setup depth clear
            if ((flags & CLEARFLAG_DEPTH) && renderTarget.depth) {
                const depth = options.depth ?? defaultOptions.depth;
                uniformBuffer.set('depth', depth);
                device.setDepthState(DepthState.WRITEDEPTH);

            } else {
                uniformBuffer.set('depth', 1);
                device.setDepthState(DepthState.NODEPTH);
            }

            // setup stencil clear
            if ((flags & CLEARFLAG_STENCIL) && renderTarget.stencil) {
                Debug.warnOnce("ClearRenderer does not support stencil clear at the moment");
            }

            uniformBuffer.endUpdate();

            device.setCullMode(CULLFACE_NONE);

            // render 4 vertices without vertex buffer
            device.setShader(this.shader);
            device.draw(primitive);

            DebugGraphics.popGpuMarker(device);
        }
    }
}

export { WebgpuClearRenderer };
