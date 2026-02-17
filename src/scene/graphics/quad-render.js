import { Debug, DebugHelper } from '../../core/debug.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BindGroup, DynamicBindGroup } from '../../platform/graphics/bind-group.js';
import { BINDGROUP_MESH, BINDGROUP_MESH_UB, BINDGROUP_VIEW, PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';

/**
 * @import { Shader } from '../../platform/graphics/shader.js'
 */

const _quadPrimitive = {
    type: PRIMITIVE_TRIANGLES,
    base: 0,
    count: 6,
    indexed: true
};

const _tempViewport = new Vec4();
const _tempScissor = new Vec4();
const _dynamicBindGroup = new DynamicBindGroup();

/**
 * An object that renders a quad using a {@link Shader}.
 *
 * Note: QuadRender does not modify render states. Before calling {@link QuadRender#render},
 * you should set up the following states as needed, otherwise previously set states will be used:
 * - Blend state via {@link GraphicsDevice#setBlendState}
 * - Cull mode via {@link GraphicsDevice#setCullMode}
 * - FrontFace via {@link GraphicsDevice#setFrontFace}
 * - Depth state via {@link GraphicsDevice#setDepthState}
 * - Stencil state via {@link GraphicsDevice#setStencilState}
 *
 * Example:
 *
 * ```javascript
 * const shader = pc.ShaderUtils.createShader(app.graphicsDevice, {
 *     uniqueName: 'MyShader',
 *     attributes: { aPosition: SEMANTIC_POSITION },
 *     vertexGLSL: '// vertex shader code',
 *     fragmentGLSL: '// fragment shader code'
 * });
 * const quad = new QuadRender(shader);
 *
 * // Set up render states before rendering
 * app.graphicsDevice.setBlendState(BlendState.NOBLEND);
 * app.graphicsDevice.setCullMode(CULLFACE_NONE);
 * app.graphicsDevice.setFrontFace(FRONTFACE_CCW);
 * app.graphicsDevice.setDepthState(DepthState.NODEPTH);
 * app.graphicsDevice.setStencilState(null, null);
 *
 * quad.render();
 * quad.destroy();
 * ```
 *
 * @category Graphics
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
     * @param {Shader} shader - The shader to be used to render the quad.
     */
    constructor(shader) {

        const device = shader.device;
        this.shader = shader;
        Debug.assert(shader);

        if (device.supportsUniformBuffers) {

            // add uniform buffer support to shader
            const processingOptions = new ShaderProcessorOptions();
            this.shader = ShaderUtils.processShader(shader, processingOptions);

            // uniform buffer
            const ubFormat = this.shader.meshUniformBufferFormat;
            if (ubFormat) {
                this.uniformBuffer = new UniformBuffer(device, ubFormat, false);
            }

            // bind group
            const bindGroupFormat = this.shader.meshBindGroupFormat;
            Debug.assert(bindGroupFormat);
            this.bindGroup = new BindGroup(device, bindGroupFormat);
            DebugHelper.setName(this.bindGroup, `QuadRender-MeshBindGroup_${this.bindGroup.id}`);
        }
    }

    /**
     * Destroys the resources associated with this instance.
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
     * @param {Vec4} [viewport] - The viewport rectangle of the quad, in pixels. The viewport is
     * not changed if not provided.
     * @param {Vec4} [scissor] - The scissor rectangle of the quad, in pixels. Used only if the
     * viewport is provided.
     * @param {number} [numInstances] - Number of instances to draw. When provided, renders
     * multiple quads using instanced drawing. Each instance can use the instance index
     * (`gl_InstanceID` in GLSL, `pcInstanceIndex` in WGSL) to fetch per-quad data from
     * a texture or buffer, allowing each quad to be parameterized independently.
     */
    render(viewport, scissor, numInstances) {

        const device = this.shader.device;
        DebugGraphics.pushGpuMarker(device, 'QuadRender');

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

        device.setVertexBuffer(device.quadVertexBuffer);

        const shader = this.shader;
        device.setShader(shader);

        if (device.supportsUniformBuffers) {

            // not using view bind group
            device.setBindGroup(BINDGROUP_VIEW, device.emptyBindGroup);

            // mesh bind group
            const bindGroup = this.bindGroup;
            bindGroup.update();
            device.setBindGroup(BINDGROUP_MESH, bindGroup);

            // dynamic uniform buffer bind group
            const uniformBuffer = this.uniformBuffer;
            if (uniformBuffer) {
                uniformBuffer.update(_dynamicBindGroup);
                device.setBindGroup(BINDGROUP_MESH_UB, _dynamicBindGroup.bindGroup, _dynamicBindGroup.offsets);
            } else {
                device.setBindGroup(BINDGROUP_MESH_UB, device.emptyBindGroup);
            }
        }

        device.draw(_quadPrimitive, device.quadIndexBuffer, numInstances);

        // restore if changed
        if (viewport) {
            device.setViewport(_tempViewport.x, _tempViewport.y, _tempViewport.z, _tempViewport.w);
            device.setScissor(_tempScissor.x, _tempScissor.y, _tempScissor.z, _tempScissor.w);
        }

        DebugGraphics.popGpuMarker(device);
    }
}

export { QuadRender };
