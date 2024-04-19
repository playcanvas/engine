import { Debug } from '../../core/debug.js';

import { BUFFER_GPUDYNAMIC, PRIMITIVE_POINTS } from './constants.js';
import { VertexBuffer } from './vertex-buffer.js';
import { DebugGraphics } from './debug-graphics.js';
import { Shader } from './shader.js';
import { ShaderUtils } from './shader-utils.js';

/**
 * This object allows you to configure and use the transform feedback feature (WebGL2 only). How to
 * use:
 *
 * 1. First, check that you're on WebGL2, by looking at the `app.graphicsDevice.isWebGL2`` value.
 * 2. Define the outputs in your vertex shader. The syntax is `out vec3 out_vertex_position`,
 * note that there must be out_ in the name. You can then simply assign values to these outputs in
 * VS. The order and size of shader outputs must match the output buffer layout.
 * 3. Create the shader using `TransformFeedback.createShader(device, vsCode, yourShaderName)`.
 * 4. Create/acquire the input vertex buffer. Can be any VertexBuffer, either manually created, or
 * from a Mesh.
 * 5. Create the TransformFeedback object: `const tf = new TransformFeedback(inputBuffer)`. This
 * object will internally create an output buffer.
 * 6. Run the shader: `tf.process(shader)`. Shader will take the input buffer, process it and write
 * to the output buffer, then the input/output buffers will be automatically swapped, so you'll
 * immediately see the result.
 *
 * ```javascript
 * // *** shader asset ***
 * attribute vec3 vertex_position;
 * attribute vec3 vertex_normal;
 * attribute vec2 vertex_texCoord0;
 * out vec3 out_vertex_position;
 * out vec3 out_vertex_normal;
 * out vec2 out_vertex_texCoord0;
 * void main(void) {
 *     // read position and normal, write new position (push away)
 *     out_vertex_position = vertex_position + vertex_normal * 0.01;
 *     // pass other attributes unchanged
 *     out_vertex_normal = vertex_normal;
 *     out_vertex_texCoord0 = vertex_texCoord0;
 * }
 * ```
 *
 * ```javascript
 * // *** script asset ***
 * var TransformExample = pc.createScript('transformExample');
 *
 * // attribute that references shader asset and material
 * TransformExample.attributes.add('shaderCode', { type: 'asset', assetType: 'shader' });
 * TransformExample.attributes.add('material', { type: 'asset', assetType: 'material' });
 *
 * TransformExample.prototype.initialize = function() {
 *     const device = this.app.graphicsDevice;
 *     const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.TorusGeometry({ tubeRadius: 0.01, ringRadius: 3 }));
 *     const meshInstance = new pc.MeshInstance(mesh, this.material.resource);
 *     const entity = new pc.Entity();
 *     entity.addComponent('render', {
 *         type: 'asset',
 *         meshInstances: [meshInstance]
 *     });
 *     app.root.addChild(entity);
 *
 *     // if webgl2 is not supported, transform-feedback is not available
 *     if (!device.isWebGL2) return;
 *     const inputBuffer = mesh.vertexBuffer;
 *     this.tf = new pc.TransformFeedback(inputBuffer);
 *     this.shader = pc.TransformFeedback.createShader(device, this.shaderCode.resource, "tfMoveUp");
 * };
 *
 * TransformExample.prototype.update = function(dt) {
 *     if (!this.app.graphicsDevice.isWebGL2) return;
 *     this.tf.process(this.shader);
 * };
 * ```
 *
 * @category Graphics
 */
class TransformFeedback {
    /**
     * Create a new TransformFeedback instance.
     *
     * @param {VertexBuffer} inputBuffer - The input vertex buffer.
     * @param {number} [usage] - The optional usage type of the output vertex buffer. Can be:
     *
     * - {@link BUFFER_STATIC}
     * - {@link BUFFER_DYNAMIC}
     * - {@link BUFFER_STREAM}
     * - {@link BUFFER_GPUDYNAMIC}
     *
     * Defaults to {@link BUFFER_GPUDYNAMIC} (which is recommended for continuous update).
     */
    constructor(inputBuffer, usage = BUFFER_GPUDYNAMIC) {
        this.device = inputBuffer.device;
        const gl = this.device.gl;

        Debug.assert(inputBuffer.format.interleaved || inputBuffer.format.elements.length <= 1,
                     "Vertex buffer used by TransformFeedback needs to be interleaved.");

        this._inputBuffer = inputBuffer;
        if (usage === BUFFER_GPUDYNAMIC && inputBuffer.usage !== usage) {
            // have to recreate input buffer with other usage
            gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer.impl.bufferId);
            gl.bufferData(gl.ARRAY_BUFFER, inputBuffer.storage, gl.DYNAMIC_COPY);
        }

        this._outputBuffer = new VertexBuffer(inputBuffer.device, inputBuffer.format, inputBuffer.numVertices, {
            usage: usage,
            data: inputBuffer.storage
        });
    }

    /**
     * Creates a transform feedback ready vertex shader from code.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
     * used by the renderer.
     * @param {string} vertexCode - Vertex shader code. Should contain output variables starting with "out_".
     * @param {string} name - Unique name for caching the shader.
     * @returns {Shader} A shader to use in the process() function.
     */
    static createShader(graphicsDevice, vertexCode, name) {
        return new Shader(graphicsDevice, ShaderUtils.createDefinition(graphicsDevice, {
            name,
            vertexCode,
            useTransformFeedback: true
        }));
    }

    /**
     * Destroys the transform feedback helper object.
     */
    destroy() {
        this._outputBuffer.destroy();
    }

    /**
     * Runs the specified shader on the input buffer, writes results into the new buffer, then
     * optionally swaps input/output.
     *
     * @param {Shader} shader - A vertex shader to run. Should be created with
     * {@link TransformFeedback.createShader}.
     * @param {boolean} [swap] - Swap input/output buffer data. Useful for continuous buffer
     * processing. Default is true.
     */
    process(shader, swap = true) {
        const device = this.device;

        DebugGraphics.pushGpuMarker(device, "TransformFeedback");

        const oldRt = device.getRenderTarget();
        device.setRenderTarget(null);
        device.updateBegin();
        device.setVertexBuffer(this._inputBuffer, 0);
        device.setRaster(false);
        device.setTransformFeedbackBuffer(this._outputBuffer);
        device.setShader(shader);
        device.draw({
            type: PRIMITIVE_POINTS,
            base: 0,
            count: this._inputBuffer.numVertices,
            indexed: false
        });
        device.setTransformFeedbackBuffer(null);
        device.setRaster(true);
        device.updateEnd();
        device.setRenderTarget(oldRt);

        DebugGraphics.popGpuMarker(device);

        // swap buffers
        if (swap) {
            let tmp = this._inputBuffer.impl.bufferId;
            this._inputBuffer.impl.bufferId = this._outputBuffer.impl.bufferId;
            this._outputBuffer.impl.bufferId = tmp;

            // swap VAO
            tmp = this._inputBuffer.impl.vao;
            this._inputBuffer.impl.vao = this._outputBuffer.impl.vao;
            this._outputBuffer.impl.vao = tmp;
        }
    }

    /**
     * The current input buffer.
     *
     * @type {VertexBuffer}
     */
    get inputBuffer() {
        return this._inputBuffer;
    }

    /**
     * The current output buffer.
     *
     * @type {VertexBuffer}
     */
    get outputBuffer() {
        return this._outputBuffer;
    }
}

export { TransformFeedback };
