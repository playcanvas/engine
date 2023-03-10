import { Debug, DebugHelper } from "../../../core/debug.js";
import { BindBufferFormat, BindGroupFormat } from "../bind-group-format.js";
import { UniformBufferFormat, UniformFormat } from "../uniform-buffer-format.js";
import { BlendState } from "../blend-state.js";
import {
    PRIMITIVE_TRISTRIP, SHADERLANGUAGE_WGSL, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX,
    UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC4, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, BINDGROUP_MESH, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL
} from "../constants.js";
import { Shader } from "../shader.js";
import { BindGroup } from "../bind-group.js";
import { UniformBuffer } from "../uniform-buffer.js";
import { DebugGraphics } from "../debug-graphics.js";

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

            @group(0) @binding(0) var<uniform> ubMesh : ub_mesh;

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
        ]));

        // format of the bind group
        const bindGroupFormat = new BindGroupFormat(device, [
            new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)
        ]);

        // bind group
        this.bindGroup = new BindGroup(device, bindGroupFormat, this.uniformBuffer);
        DebugHelper.setName(this.bindGroup, `ClearRenderer-BindGroup_${this.bindGroup.id}`);

        // uniform data
        this.colorData = new Float32Array(4);
        this.colorId = device.scope.resolve('color');
        this.depthId = device.scope.resolve('depth');


        // TODO: WebGPU does not handle depth state, and so we pass this hack to render pipeline creation
        // to avoid depth test (always write)
        this.shader.impl.hackAlwaysWrite = true;
    }

    clear(device, renderTarget, options, defaultOptions) {
        options = options || defaultOptions;

        const flags = options.flags ?? defaultOptions.flags;
        if (flags !== 0) {

            DebugGraphics.pushGpuMarker(device, 'CLEAR-RENDERER');

            // setup clear color
            if ((flags & CLEARFLAG_COLOR) && renderTarget.colorBuffer) {
                const color = options.color ?? defaultOptions.color;
                this.colorData.set(color);

                device.setBlendState(BlendState.DEFAULT);
            } else {
                device.setBlendState(BlendState.NOWRITE);
            }
            this.colorId.setValue(this.colorData);

            // setup depth clear
            if ((flags & CLEARFLAG_DEPTH) && renderTarget.depth) {
                const depth = options.depth ?? defaultOptions.depth;
                this.depthId.setValue(depth);

                // TODO: set up depth state to write / not write to depth

            } else {
                this.depthId.setValue(1);
            }

            // setup stencil clear
            if ((flags & CLEARFLAG_STENCIL) && renderTarget.stencil) {
                Debug.warnOnce("ClearRenderer does not support stencil clear at the moment");
            }

            // render 4 verticies without vertex buffer
            device.setShader(this.shader);

            const bindGroup = this.bindGroup;
            if (bindGroup.defaultUniformBuffer) {
                bindGroup.defaultUniformBuffer.update();
            }
            bindGroup.update();
            device.setBindGroup(BINDGROUP_MESH, bindGroup);

            device.draw(primitive);

            DebugGraphics.popGpuMarker(device);
        }
    }
}

export { WebgpuClearRenderer };
