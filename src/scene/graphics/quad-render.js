import { Debug, DebugHelper } from "../../core/debug.js";
import { Vec4 } from "../../core/math/vec4.js";
import { BindGroup } from "../../platform/graphics/bind-group.js";
import { BINDGROUP_MESH, PRIMITIVE_TRISTRIP } from "../../platform/graphics/constants.js";
import { DebugGraphics } from "../../platform/graphics/debug-graphics.js";
import { ShaderProcessorOptions } from "../../platform/graphics/shader-processor-options.js";
import { UniformBuffer } from "../../platform/graphics/uniform-buffer.js";
import { processShader } from "../shader-lib/utils.js";

const _quadPrimitive = {
    type: PRIMITIVE_TRISTRIP,
    base: 0,
    count: 4,
    indexed: false
};

const _tempViewport = new Vec4();
const _tempScissor = new Vec4();

/**
 * An object that renders a quad using a {@link Shader}.
 *
 * Example:
 *
 * ```javascript
 * var = pc.createShaderFromCode(app.graphicsDevice, vertexShader, fragmentShader, `MyShader`);
 * var quad = new QuadRender(shader);
 * quad.render();
 * quad.destroy();
 * ```
 */
class QuadRender {
    /**
     * @type {UniformBuffer}
     * @ignore
     */
    uniformBuffer;

    /**
     * @type {BindGroup}
     * @ignore
     */
    bindGroup;

    /**
     * Create a new QuadRender instance.
     *
     * @param {import('../../platform/graphics/shader.js').Shader} shader - The shader to be used to render the quad.
     */
    constructor(shader) {

        const device = shader.device;
        this.shader = shader;
        Debug.assert(shader);

        if (device.supportsUniformBuffers) {

            // add uniform buffer support to shader
            const processingOptions = new ShaderProcessorOptions();
            this.shader = processShader(shader, processingOptions);

            // uniform buffer
            const ubFormat = this.shader.meshUniformBufferFormat;
            if (ubFormat) {
                this.uniformBuffer = new UniformBuffer(device, ubFormat);
            }

            // bind group
            const bindGroupFormat = this.shader.meshBindGroupFormat;
            Debug.assert(bindGroupFormat);
            this.bindGroup = new BindGroup(device, bindGroupFormat, this.uniformBuffer);
            DebugHelper.setName(this.bindGroup, `QuadRender-MeshBindGroup_${this.bindGroup.id}`);
        }
    }

    /**
     * Destroyes the resources associated with this instance.
     */
    destroy() {
        this.uniformBuffer?.destroy();
        this.uniformBuffer = null;

        this.bindGroup?.destroy();
        this.bindGroup = null;
    }

    /**
     * Renders the quad. If the viewport is provided, the original viewport and scissor is restored
     * after the rendering.
     *
     * @param {import('../../core/math/vec4.js').Vec4} [viewport] - The viewport rectangle of the
     * quad, in pixels. The viewport is not changed if not provided.
     * @param {import('../../core/math/vec4.js').Vec4} [scissor] - The scissor rectangle of the
     * quad, in pixels. Used only if the viewport is provided.
     */
    render(viewport, scissor) {

        const device = this.shader.device;
        DebugGraphics.pushGpuMarker(device, "QuadRender");

        // only modify viewport or scissor if viewport supplied
        if (viewport) {

            // backup current settings
            _tempViewport.set(device.vx, device.vy, device.vw, device.vh);
            _tempScissor.set(device.sx, device.sy, device.sw, device.sh);

            // set new values
            scissor = scissor ?? viewport;
            device.setViewport(viewport.x, viewport.y, viewport.z, viewport.w);
            device.setScissor(scissor.x, scissor.y, scissor.z, scissor.w);
        }

        device.setVertexBuffer(device.quadVertexBuffer, 0);

        const shader = this.shader;
        device.setShader(shader);

        if (device.supportsUniformBuffers) {

            const bindGroup = this.bindGroup;
            if (bindGroup.defaultUniformBuffer) {
                bindGroup.defaultUniformBuffer.update();
            }
            bindGroup.update();
            device.setBindGroup(BINDGROUP_MESH, bindGroup);
        }

        device.draw(_quadPrimitive);

        // restore if changed
        if (viewport) {
            device.setViewport(_tempViewport.x, _tempViewport.y, _tempViewport.z, _tempViewport.w);
            device.setScissor(_tempScissor.x, _tempScissor.y, _tempScissor.z, _tempScissor.w);
        }

        DebugGraphics.popGpuMarker(device);
    }
}

export { QuadRender };
