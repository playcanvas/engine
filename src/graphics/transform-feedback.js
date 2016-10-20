pc.extend(pc, function () {
    'use strict';

    /**
     * @name pc.TransformFeedback
     * @class (Short description)
     * @description (Long description)
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device
     */
    var TransformFeedback = function (inputBuffer, usage) {
        this.device = inputBuffer.device;
        var gl = this.device.gl;
        this.feedback = gl.createTransformFeedback();
        this.inVb = inputBuffer;
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
            this.device.gl.deleteTransformFeedback(this.feedback);
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
            device.setTransformFeedback(this);
            device.setShader(shader);
            device.draw({
                type: pc.PRIMITIVE_POINTS,
                base: 0,
                count: this.inVb.numVertices,
                indexed: false
            });
            device.setTransformFeedback(null);
            device.setRaster(true);
            device.updateEnd();
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
