import { Debug } from '../../core/debug.js';
import { BUFFER_GPUDYNAMIC, PRIMITIVE_POINTS, TRANSFORM_FEEDBACK_INTERLEAVED, TRANSFORM_FEEDBACK_SEPARATE } from './constants.js';
import { VertexBuffer } from './vertex-buffer.js';
import { DebugGraphics } from './debug-graphics.js';
import { Shader } from './shader.js';
import { ShaderDefinitionUtils } from './shader-definition-utils.js';

/**
 * @import { GraphicsDevice } from './graphics-device.js'
 */

/**
 * Gives a vertex buffer its role in a {@link TransformFeedback}. At least one of the two properties
 * must be specified.
 *
 * @typedef {object} TransformFeedbackStream
 * @property {VertexBuffer} [input] - A buffer read by the shader as a vertex stream.
 * @property {VertexBuffer} [output] - A buffer written by transform feedback.
 */

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
 * var TransformExample = createScript('transformExample');
 *
 * // attribute that references shader asset and material
 * TransformExample.attributes.add('shaderCode', { type: 'asset', assetType: 'shader' });
 * TransformExample.attributes.add('material', { type: 'asset', assetType: 'material' });
 *
 * TransformExample.prototype.initialize = function() {
 *     const device = this.app.graphicsDevice;
 *     const mesh = Mesh.fromGeometry(app.graphicsDevice, new TorusGeometry({ tubeRadius: 0.01, ringRadius: 3 }));
 *     const meshInstance = new MeshInstance(mesh, this.material.resource);
 *     const entity = new Entity();
 *     entity.addComponent('render', {
 *         type: 'asset',
 *         meshInstances: [meshInstance]
 *     });
 *     app.root.addChild(entity);
 *
 *     // if webgl2 is not supported, transform-feedback is not available
 *     if (!device.isWebGL2) return;
 *     const inputBuffer = mesh.vertexBuffer;
 *     this.tf = new TransformFeedback(inputBuffer);
 *     this.shader = TransformFeedback.createShader(device, this.shaderCode.resource, "tfMoveUp");
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
     * @param {VertexBuffer|TransformFeedbackStream[]} inputBuffer - The input vertex buffer, or an
     * array of buffer descriptors when more than one buffer takes part. Each descriptor gives a
     * buffer one of three roles:
     *
     * - `{ input, output }` - read by the shader and written by transform feedback. The pair is
     * swapped after each step, so `input` always holds the freshest data.
     * - `{ input }` - read by the shader only. Suitable for per-item data which never changes, and
     * which would otherwise have to be copied through transform feedback every step.
     * - `{ output }` - written by transform feedback only. Suitable for data which only a later
     * pass consumes, such as a stream feeding instanced rendering.
     *
     * Descriptors with an `output` are assigned transform feedback buffer indices in the order they
     * appear, skipping those without one, and so must match the order of the captured varyings.
     * @param {VertexBuffer} [outputBuffer] - The optional output buffer, when a single input buffer
     * is specified. If omitted, a buffer with parameters matching the input buffer is created.
     * @param {number} [usage] - The optional usage type of the created output vertex buffer. Can be:
     *
     * - {@link BUFFER_STATIC}
     * - {@link BUFFER_DYNAMIC}
     * - {@link BUFFER_STREAM}
     * - {@link BUFFER_GPUDYNAMIC}
     *
     * Defaults to {@link BUFFER_GPUDYNAMIC} (which is recommended for continuous update).
     * @example
     * // a simulation writing its state back to itself, plus a stream consumed by instancing
     * const tf = new TransformFeedback([
     *     { input: positions, output: positionsOut },  // read and written, swapped each step
     *     { input: constants },                        // read only, never modified
     *     { output: instances }                        // written only, for the render pass
     * ]);
     */
    constructor(inputBuffer, outputBuffer, usage = BUFFER_GPUDYNAMIC) {

        // the descriptor form - this test must precede the legacy usage test below, as an array is
        // not a VertexBuffer
        const descriptors = Array.isArray(inputBuffer) ? inputBuffer : null;

        if (!descriptors && outputBuffer !== undefined && !(outputBuffer instanceof VertexBuffer)) {

            Debug.deprecated('Such a constructor that takes the second parameter usage is deprecated.');

            usage = outputBuffer;
            outputBuffer = undefined;
        }

        Debug.assert(!descriptors || descriptors.length > 0, 'TransformFeedback requires at least one buffer.');
        Debug.call(() => {
            descriptors?.forEach((descriptor, index) => {
                Debug.assert(descriptor?.input || descriptor?.output,
                    `TransformFeedback buffer descriptor at index ${index} specifies neither an input nor an output buffer.`);
            });
        });

        const entries = descriptors ?? [{ input: inputBuffer, output: outputBuffer }];

        this.device = (entries[0].input ?? entries[0].output).device;

        // buffers read by the shader, in any order - they bind by the semantics of their format
        this._inputBuffers = entries.filter(entry => entry.input).map(entry => entry.input);

        // buffers written by transform feedback, in the order of the captured varyings
        this._outputBuffers = [];

        // input/output pairs which are swapped after each step
        this._swapPairs = [];

        // output buffers created here, and so owned by this instance
        this._ownedOutputBuffers = [];

        entries.forEach((entry) => {

            const input = entry.input;
            let output = entry.output;

            Debug.call(() => {
                const vb = input ?? output;
                Debug.assert(vb.format.interleaved || vb.format.elements.length <= 1,
                    'A vertex buffer used by TransformFeedback needs to be interleaved.');
            });

            // create the matching output buffer when only an input was given by the single buffer
            // form, preserving the long standing behaviour of that form
            if (input && output === undefined && !descriptors) {
                output = this._createOutputBuffer(input, usage);
                this._ownedOutputBuffers.push(output);
            }

            if (output) {
                this._outputBuffers.push(output);
                if (input) {
                    this._swapPairs.push({ input, output });
                }
            }
        });

        Debug.assert(this._outputBuffers.length > 0, 'TransformFeedback requires at least one output buffer.');
    }

    /**
     * Creates an output buffer matching the supplied input buffer.
     *
     * @param {VertexBuffer} inputBuffer - The buffer to match.
     * @param {number} usage - The usage type of the created buffer.
     * @returns {VertexBuffer} The created buffer.
     * @private
     */
    _createOutputBuffer(inputBuffer, usage) {

        if (usage === BUFFER_GPUDYNAMIC && inputBuffer.usage !== usage) {
            // Supplying a buffer with another usage is supported - "any VertexBuffer, either
            // manually created, or from a Mesh" - so adopt it by re-uploading its contents to
            // change the usage. This is a one-time cost at construction.
            const gl = this.device.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer.impl.bufferId);
            gl.bufferData(gl.ARRAY_BUFFER, inputBuffer.storage, gl.DYNAMIC_COPY);
        }

        return new VertexBuffer(inputBuffer.device, inputBuffer.format, inputBuffer.numVertices, {
            usage: usage,
            data: inputBuffer.storage
        });
    }

    /**
     * Creates a transform feedback ready vertex shader from code.
     *
     * @param {GraphicsDevice} graphicsDevice - The graphics device used by the renderer.
     * @param {string} vertexCode - Vertex shader code. Should contain output variables starting with "out_" or feedbackVaryings.
     * @param {string} name - Unique name for caching the shader.
     * @param {string[]} [feedbackVaryings] - A list of shader output variable names that will be captured.
     * @param {number} [feedbackVaryingsMode] - Specifies how transform feedback varyings
     * are written into GPU buffers. Use {@link TRANSFORM_FEEDBACK_INTERLEAVED} to pack all captured
     * varyings into a single buffer, or {@link TRANSFORM_FEEDBACK_SEPARATE} to store each varying
     * in its own buffer. This setting is only effective when useTransformFeedback property is enabled.
     * Defaults to {@link TRANSFORM_FEEDBACK_INTERLEAVED}.
     * @returns {Shader} A shader to use in the process() function.
     */
    static createShader(graphicsDevice, vertexCode, name, feedbackVaryings, feedbackVaryingsMode = TRANSFORM_FEEDBACK_INTERLEAVED) {
        return new Shader(graphicsDevice, ShaderDefinitionUtils.createDefinition(graphicsDevice, {
            name,
            vertexCode,
            feedbackVaryings,
            feedbackVaryingsMode,
            useTransformFeedback: true,
            fragmentCode: 'void main(void) {gl_FragColor = vec4(0.0);}'
        }));
    }

    /**
     * Destroys the transform feedback helper object.
     */
    destroy() {
        this._ownedOutputBuffers.forEach(buffer => buffer.destroy());
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

        DebugGraphics.pushGpuMarker(device, 'TransformFeedback');

        Debug.call(() => {
            const separate = shader.definition.feedbackVaryingsMode === TRANSFORM_FEEDBACK_SEPARATE;
            const expected = separate ? (shader.definition.feedbackVaryings?.length ?? 0) : 1;
            Debug.assert(expected === this._outputBuffers.length,
                separate ?
                    `A shader using TRANSFORM_FEEDBACK_SEPARATE captures each varying into its own buffer, so it needs ${expected} output buffers, but ${this._outputBuffers.length} were supplied.` :
                    `A shader using TRANSFORM_FEEDBACK_INTERLEAVED captures all varyings into a single buffer, but ${this._outputBuffers.length} output buffers were supplied.`
            );

        });

        const oldRt = device.getRenderTarget();
        device.setRenderTarget(null);
        device.updateBegin();
        this._inputBuffers.forEach(buffer => device.setVertexBuffer(buffer));
        device.setRaster(false);
        device.setTransformFeedbackBuffers(this._outputBuffers);
        device.setShader(shader);
        device.draw({
            type: PRIMITIVE_POINTS,
            base: 0,
            baseVertex: 0,
            count: this._inputBuffers[0].numVertices,
            indexed: false
        });
        device.setTransformFeedbackBuffers(null);
        device.setRaster(true);
        device.updateEnd();
        device.setRenderTarget(oldRt);

        DebugGraphics.popGpuMarker(device);

        // swap buffers - only descriptors specifying both an input and an output take part, read-only
        // and write-only buffers are left alone
        if (swap) {
            this._swapPairs.forEach(({ input, output }) => {

                Debug.call(() => {
                    if (input.format !== output.format) {
                        Debug.warnOnce('Trying to swap buffers with different formats.');
                    }
                });

                let tmp = input.impl.bufferId;
                input.impl.bufferId = output.impl.bufferId;
                output.impl.bufferId = tmp;

                // swap VAO
                tmp = input.impl.vao;
                input.impl.vao = output.impl.vao;
                output.impl.vao = tmp;
            });

            // The swap exchanged the GPU buffers behind the input and output VertexBuffer objects,
            // but the objects themselves are unchanged. For a single input buffer that is enough, as
            // its vertex array object lives on the buffer and was swapped along with it. For more
            // than one input buffer the draw takes its vertex array object from the device cache,
            // which is keyed on the VertexBuffer objects - so the exchange is invisible to it, and
            // the cached vertex array object would keep reading the pre-swap buffers. Drop it, so
            // the next step rebuilds it against the buffers which are now current. Note this must be
            // keyed on every input buffer, including read-only ones, as they all took part in
            // building the vertex array object.
            device.removeVertexArrayFromCache(this._inputBuffers);
        }
    }

    /**
     * The current input buffer. When multiple input buffers are used, this is the first one - see
     * {@link TransformFeedback#inputBuffers}.
     *
     * @type {VertexBuffer}
     */
    get inputBuffer() {
        return this._inputBuffers[0];
    }

    /**
     * The current output buffer. When multiple output buffers are used, this is the first one - see
     * {@link TransformFeedback#outputBuffers}.
     *
     * @type {VertexBuffer}
     */
    get outputBuffer() {
        return this._outputBuffers[0];
    }

    /**
     * The buffers read by the shader, in the order they were supplied.
     *
     * @type {VertexBuffer[]}
     */
    get inputBuffers() {
        return this._inputBuffers;
    }

    /**
     * The buffers written by transform feedback, in the order of the captured varyings.
     *
     * @type {VertexBuffer[]}
     */
    get outputBuffers() {
        return this._outputBuffers;
    }
}

export { TransformFeedback };
