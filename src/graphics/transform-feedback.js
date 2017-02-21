pc.extend(pc, function () {
    'use strict';

    /**
     * @name pc.TransformFeedback
     * @class Transform feedback helper object
     * @description This object allows you to configure and use the transform feedback feature (WebGL2 only).
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
