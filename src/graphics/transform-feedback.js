Object.assign(pc, function () {
    'use strict';

    /**
     * @constructor
     * @name pc.TransformFeedback
     * @classdesc Transform feedback helper object.
     * @description This object allows you to configure and use the transform feedback feature (WebGL2 only).
     *  How to use:<br>
     *  <ol>
     *  <li>First, check that you're on WebGL2, by looking at the <code>app.graphicsDevice.webgl2</code> value.</li>
     *  <li>Define the outputs in your vertex shader. The syntax is <code>out vec3 out_vertex_position</code>, note that there must be out_ in the name. You can then simply assign values to these outputs in VS. The order and size of shader outputs must match the output buffer layout.</li>
     *  <li>Create the shader using <code>pc.TransformFeedback.createShader(device, vsCode, yourShaderName)</code>.</li>
     *  <li>Create/acquire the input vertex buffer. Can be any pc.VertexBuffer, either manually created, or from a pc.Mesh.</li>
     *  <li>Create the pc.TransformFeedback object: <code>var tf = new pc.TransformFeedback(inputBuffer)</code>. This object will internally create an output buffer.</li>
     *  <li>Run the shader: <code>tf.process(shader)</code>. Shader will take the input buffer, process it and write to the output buffer, then the input/output buffers will be automatically swapped, so you'll immediately see the result.</li>
     *  </ol>
     * @example
     * // *** shader asset ***
     * attribute vec3 vertex_position;
     * attribute vec3 vertex_normal;
     * attribute vec2 vertex_texCoord0;
     * attribute vec4 vertex_tangent;
     * out vec3 out_vertex_position;
     * out vec3 out_vertex_normal;
     * out vec2 out_vertex_texCoord0;
     * out vec4 out_vertex_tangent;
     * void main(void) {
     *     // read position and normal, write new position (push away)
     *     out_vertex_position = vertex_position + vertex_normal * 0.01;
     *     // pass other attributes unchanged
     *     out_vertex_normal = vertex_normal;
     *     out_vertex_texCoord0 = vertex_texCoord0;
     *     out_vertex_tangent = vertex_tangent;
     * }
     * @example
     * // *** script asset ***
     * var TransformExample = pc.createScript('transformExample');
     *
     * // attribute that references shader asset and material
     * TransformExample.attributes.add('shaderCode', { type: 'asset', assetType: 'shader' });
     * TransformExample.attributes.add('material', { type: 'asset', assetType: 'material' });
     *
     * TransformExample.prototype.initialize = function() {
     *     var device = this.app.graphicsDevice;
     *     var mesh = pc.createTorus(device, { tubeRadius: 0.01, ringRadius: 3 });
     *     var node = new pc.GraphNode();
     *     var meshInstance = new pc.MeshInstance(node, mesh, this.material.resource);
     *     var model = new pc.Model();
     *     model.graph = node;
     *     model.meshInstances = [ meshInstance ];
     *     this.app.scene.addModel(model);
     *
     *     // if webgl2 is not supported, TF is not available
     *     if (!device.webgl2) return;
     *     var inputBuffer = mesh.vertexBuffer;
     *     this.tf = new pc.TransformFeedback(inputBuffer);
     *     this.shader = pc.TransformFeedback.createShader(device, this.shaderCode.resource, "tfMoveUp");
     * };
     *
     * TransformExample.prototype.update = function(dt) {
     *     if (!this.app.graphicsDevice.webgl2) return;
     *     this.tf.process(this.shader);
     * };
     * @param {pc.VertexBuffer} inputBuffer The input vertex buffer
     * @param {Number} [usage] The optional usage type of the output vertex buffer (see pc.BUFFER_*). pc.BUFFER_GPUDYNAMIC is recommended for continuous update, and is the default value.
     */
    var TransformFeedback = function (inputBuffer, usage) {
        usage = usage || pc.BUFFER_GPUDYNAMIC;
        this.device = inputBuffer.device;
        var gl = this.device.gl;

        this._inputBuffer = inputBuffer;
        if (usage === pc.BUFFER_GPUDYNAMIC && inputBuffer.usage !== usage) {
            // have to recreate input buffer with other usage
            gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer.bufferId);
            gl.bufferData(gl.ARRAY_BUFFER, inputBuffer.storage, gl.DYNAMIC_COPY);
        }

        this._outputBuffer = new pc.VertexBuffer(inputBuffer.device, inputBuffer.format, inputBuffer.numVertices, usage, inputBuffer.storage);
    };

    /**
     * @function
     * @name pc.TransformFeedback#createShader
     * @description Creates a transform feedback ready vertex shader from code.
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device used by the renderer.
     * @param {String} vsCode Vertex shader code. Should contain output variables starting with "out_".
     * @param {String} name Unique name for caching the shader.
     * @returns {pc.Shader} A shader to use in the process() function.
     */
    TransformFeedback.createShader = function (graphicsDevice, vsCode, name) {
        return pc.shaderChunks.createShaderFromCode(graphicsDevice, vsCode, null, name, true);
    };

    Object.assign(TransformFeedback.prototype, {
        /**
         * @function
         * @name pc.TransformFeedback#destroy
         * @description Destroys the transform feedback helper object
         */
        destroy: function () {
            this._outputBuffer.destroy();
        },

        /**
         * @function
         * @name pc.TransformFeedback#process
         * @description Runs the specified shader on the input buffer, writes results into the new buffer, then optionally swaps input/output.
         * @param {pc.Shader} shader A vertex shader to run. Should be created with pc.TransformFeedback.createShader.
         * @param {Boolean} [swap] Swap input/output buffer data. Useful for continuous buffer processing. Default is true.
         */
        process: function (shader, swap) {
            if (swap === undefined) swap = true;

            var device = this.device;
            device.setRenderTarget(null);
            device.updateBegin();
            device.setVertexBuffer(this._inputBuffer, 0);
            device.setRaster(false);
            device.setTransformFeedbackBuffer(this._outputBuffer);
            device.setShader(shader);
            device.draw({
                type: pc.PRIMITIVE_POINTS,
                base: 0,
                count: this._inputBuffer.numVertices,
                indexed: false
            });
            device.setTransformFeedbackBuffer(null);
            device.setRaster(true);
            device.updateEnd();

            // swap buffers
            if (swap) {
                var tmp = this._inputBuffer.bufferId;
                this._inputBuffer.bufferId = this._outputBuffer.bufferId;
                this._outputBuffer.bufferId = tmp;
            }
        }
    });

    /**
     * @readonly
     * @name pc.TransformFeedback#inputBuffer
     * @type pc.VertexBuffer
     * @description The current input buffer
     */
    Object.defineProperty(TransformFeedback.prototype, 'inputBuffer', {
        get: function () {
            return this._inputBuffer;
        }
    });

    /**
     * @readonly
     * @name pc.TransformFeedback#outputBuffer
     * @type pc.VertexBuffer
     * @description The current output buffer
     */
    Object.defineProperty(TransformFeedback.prototype, 'outputBuffer', {
        get: function () {
            return this._outputBuffer;
        }
    });

    return {
        TransformFeedback: TransformFeedback
    };
}());
