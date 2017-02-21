pc.extend(pc, function () {
    'use strict';

    /**
     * @name pc.TransformFeedback
     * @class Transform feedback helper object
     * @description This object allows you to configure and use the transform feedback feature (WebGL2 only).
     *  How to use:
     *  1. First, check that you're on WebGL2, by looking at the app.graphicsDevice.webgl2 value.
     *  2. Define the outputs in your vertex shader. The syntax is out vec3 out_vertex_position, note that there must be out_ in the name. You can then simply assign values to these outputs in VS. The order and size of shader outputs must match the output buffer layout.
     *  3. Create the shader using pc.shaderChunks.createShaderFromCode(device, vsCode, null, yourShaderName, true). The last "true" means that the vertex shader will be intended to use with the transform feedback. Note that you can also skip the fragment shader by passing null.
     *  4. Create/acquire the input vertex buffer. Can be any pc.VertexBuffer, either manually created, or from a pc.Mesh.
     *  5. Create the pc.TransformFeedback object: var tf = new pc.TransformFeedback(inputBuffer). This object will internally create an output buffer.
     *  6. Run the shader: tf.process(shader). Shader will take the input buffer, process it and write to the ouput buffer, then the input/output buffers will be automatically swapped, so you'll immediately see the result.
     * @param {pc.VertexBuffer} inputBuffer The input vertex buffer
     * @param {Number} [usage] The usage type of the output vertex buffer (see pc.BUFFER_*). pc.BUFFER_GPUDYNAMIC is recommended for continious update, and is the default value.
     */
    var TransformFeedback = function (inputBuffer, usage) {
        usage = usage || pc.BUFFER_GPUDYNAMIC;
        this.device = inputBuffer.device;
        var gl = this.device.gl;

        this.inVb = inputBuffer;
        if (usage===pc.BUFFER_GPUDYNAMIC && inputBuffer.usage!==usage) {
            // have to recreate input buffer with other usage
            gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer.bufferId);
            gl.bufferData(gl.ARRAY_BUFFER, inputBuffer.storage, gl.DYNAMIC_COPY);
        }

        this.outVb = new pc.VertexBuffer(inputBuffer.device, inputBuffer.format, inputBuffer.numVertices, usage, inputBuffer.storage);
    };

    TransformFeedback.prototype = {
        /**
         * @function
         * @name pc.TransformFeedback#destroy
         * @description ()
         */
        destroy: function () {
            this.outVb.destroy();
        },

        /**
         * @function
         * @name pc.TransformFeedback#process
         * @description ()
         */
        process: function (shader) {
            var device = this.device;
            device.setRenderTarget(null);
            device.updateBegin();
            device.setVertexBuffer(this.inVb, 0);
            device.setRaster(false);
            device.setTransformFeedbackBuffer(this.outVb);
            device.setShader(shader);
            device.draw({
                type: pc.PRIMITIVE_POINTS,
                base: 0,
                count: this.inVb.numVertices,
                indexed: false
            });
            device.setTransformFeedbackBuffer(null);
            device.setRaster(true);
            device.updateEnd();

            // swap buffers
            var tmp = this.inVb.bufferId;
            this.inVb.bufferId = this.outVb.bufferId;
            this.outVb.bufferId = tmp;
        },

        /**
         * @function
         * @name pc.TransformFeedback#getOutputBuffer
         * @description ()
         * @returns ()
         */
        getOutputBuffer: function () {
            return this.outVb;
        }
    };

    return {
        TransformFeedback: TransformFeedback
    };
}());
