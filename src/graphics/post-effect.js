Object.assign(pc, function () {

    // Primitive for drawFullscreenQuad
    var primitive = {
        type: pc.PRIMITIVE_TRISTRIP,
        base: 0,
        count: 4,
        indexed: false
    };

    /**
     * @constructor
     * @name pc.PostEffect
     * @classdesc Base class for all post effects. Post effects take a a render target as input
     * apply effects to it and then render the result to an output render target or the screen
     * if no output is specified.
     * @description Creates new PostEffect
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device of the application
     */
    var PostEffect = function (graphicsDevice) {
        this.device = graphicsDevice;
        this.shader = null;
        this.depthMap = null;
        this.vertexBuffer = pc.createFullscreenQuad(graphicsDevice);
        this.needsDepthBuffer = false;
    };

    Object.assign(PostEffect.prototype, {
        /**
         * @function
         * @name pc.PostEffect#render
         * @description Render the post effect using the specified inputTarget
         * to the specified outputTarget.
         * @param {pc.RenderTarget} inputTarget The input render target
         * @param {pc.RenderTarget} outputTarget The output render target. If null then this will be the screen.
         * @param {pc.Vec4} rect (Optional) The rect of the current camera. If not specified then it will default to [0,0,1,1]
         */
        render: function (inputTarget, outputTarget, rect) {
        }
    });

    function createFullscreenQuad(device) {
        // Create the vertex format
        var vertexFormat = new pc.VertexFormat(device, [
            { semantic: pc.SEMANTIC_POSITION, components: 2, type: pc.TYPE_FLOAT32 }
        ]);

        // Create a vertex buffer
        var vertexBuffer = new pc.VertexBuffer(device, vertexFormat, 4);

        // Fill the vertex buffer
        var iterator = new pc.VertexIterator(vertexBuffer);
        iterator.element[pc.SEMANTIC_POSITION].set(-1.0, -1.0);
        iterator.next();
        iterator.element[pc.SEMANTIC_POSITION].set(1.0, -1.0);
        iterator.next();
        iterator.element[pc.SEMANTIC_POSITION].set(-1.0, 1.0);
        iterator.next();
        iterator.element[pc.SEMANTIC_POSITION].set(1.0, 1.0);
        iterator.end();

        return vertexBuffer;
    }

    /**
     * @static
     * @function
     * @name pc.drawFullscreenQuad
     * @description Draw a screen-space rectangle in a render target. Primarily meant to be used in custom post effects based on {@link pc.PostEffect}.
     * @param {pc.GraphicsDevice} device The graphics device of the application.
     * @param {pc.RenderTarget} target The output render target.
     * @param {pc.VertexBuffer} vertexBuffer The vertex buffer for the rectangle mesh. When calling from a custom post effect, pass the field {@link pc.PostEffect#vertexBuffer}.
     * @param {pc.Shader} shader The shader to be used for drawing the rectangle. When calling from a custom post effect, pass the field {@link pc.PostEffect#shader}.
     * @param {pc.Vec4} [rect] The normalized screen-space position (rect.x, rect.y) and size (rect.z, rect.w) of the rectangle. Default is (0, 0, 1, 1);
     */
    function drawFullscreenQuad(device, target, vertexBuffer, shader, rect) {
        var oldRt = device.getRenderTarget();
        device.setRenderTarget(target);
        device.updateBegin();

        var w = (target !== null) ? target.width : device.width;
        var h = (target !== null) ? target.height : device.height;
        var x = 0;
        var y = 0;

        if (rect) {
            x = rect.x * w;
            y = rect.y * h;
            w *= rect.z;
            h *= rect.w;
        }

        var oldVx = device.vx;
        var oldVy = device.vy;
        var oldVw = device.vw;
        var oldVh = device.vh;
        device.setViewport(x, y, w, h);
        var oldSx = device.sx;
        var oldSy = device.sy;
        var oldSw = device.sw;
        var oldSh = device.sh;
        device.setScissor(x, y, w, h);

        var oldBlending = device.getBlending();
        var oldDepthTest = device.getDepthTest();
        var oldDepthWrite = device.getDepthWrite();
        var oldCullMode = device.getCullMode();
        var oldWR = device.writeRed;
        var oldWG = device.writeGreen;
        var oldWB = device.writeBlue;
        var oldWA = device.writeAlpha;
        device.setBlending(false);
        device.setDepthTest(false);
        device.setDepthWrite(false);
        device.setCullMode(pc.CULLFACE_NONE);
        device.setColorWrite(true, true, true, true);

        device.setVertexBuffer(vertexBuffer, 0);
        device.setShader(shader);

        device.draw(primitive);

        device.setBlending(oldBlending);
        device.setDepthTest(oldDepthTest);
        device.setDepthWrite(oldDepthWrite);
        device.setCullMode(oldCullMode);
        device.setColorWrite(oldWR, oldWG, oldWB, oldWA);

        device.updateEnd();

        device.setRenderTarget(oldRt);
        device.updateBegin();

        device.setViewport(oldVx, oldVy, oldVw, oldVh);
        device.setScissor(oldSx, oldSy, oldSw, oldSh);
    }

    return {
        PostEffect: PostEffect,
        createFullscreenQuad: createFullscreenQuad,
        drawFullscreenQuad: drawFullscreenQuad
    };
}());
