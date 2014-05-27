/**
 * @name pc.posteffect
 * @namespace Post Effects API
 * @description Functions for implementing post effects
 */
pc.posteffect = {};

pc.extend(pc.posteffect, function () {

    /**
     * @name pc.posteffect.PostEffect
     * @class Base class for all post effects. Post effects take a a render target as input
     * apply effects to it and then render the result to an output render target or the screen
     * if no output is specified.
     * @param {pc.gfx.Device} graphicsDevice The graphics device of the application
     */
    var PostEffect = function (graphicsDevice) {
        this.device = graphicsDevice;
        this.shader = null;
        this.depthMap = null;
        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);
    };

    PostEffect.prototype = {
        /**
        * @name pc.posteffect.PostEffect#render
        * @description Render the post effect using the specified inputTarget
        * to the specified outputTarget.
        * @param {pc.gfx.RenderTarget} inputTarget The input render target
        * @param {pc.gfx.RenderTarget} outputTarget The output render target. If null then this will be the screen.
        * @param {pc.Vec4} rect (Optional) The rect of the current camera. If not specified then it will default to [0,0,1,1]
        */
        render: function (inputTarget, outputTarget, rect) {
        }
    };

    function createFullscreenQuad (device) {
        // Create the vertex format
        var vertexFormat = new pc.gfx.VertexFormat(device, [
            { semantic: pc.gfx.SEMANTIC_POSITION, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
        ]);

        // Create a vertex buffer
        var vertexBuffer = new pc.gfx.VertexBuffer(device, vertexFormat, 4);

        // Fill the vertex buffer
        var iterator = new pc.gfx.VertexIterator(vertexBuffer);
        iterator.element[pc.gfx.SEMANTIC_POSITION].set(-1.0, -1.0);
        iterator.next();
        iterator.element[pc.gfx.SEMANTIC_POSITION].set(1.0, -1.0);
        iterator.next();
        iterator.element[pc.gfx.SEMANTIC_POSITION].set(-1.0, 1.0);
        iterator.next();
        iterator.element[pc.gfx.SEMANTIC_POSITION].set(1.0, 1.0);
        iterator.end();

        return vertexBuffer;
    }

    function drawFullscreenQuad (device, target, vertexBuffer, shader, rect) {
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

        device.setViewport(x, y, w, h);
        device.setScissor(x, y, w, h);

        var oldDepthTest = device.getDepthTest();
        var oldDepthWrite = device.getDepthWrite();
        device.setDepthTest(false);
        device.setDepthWrite(false);
        device.setVertexBuffer(vertexBuffer, 0);
        device.setShader(shader);
        device.draw({
            type: pc.gfx.PRIMITIVE_TRISTRIP,
            base: 0,
            count: 4,
            indexed: false
        });
        device.setDepthTest(oldDepthTest);
        device.setDepthWrite(oldDepthWrite);
        device.updateEnd();
    }

    return {
        PostEffect: PostEffect,
        createFullscreenQuad: createFullscreenQuad,
        drawFullscreenQuad: drawFullscreenQuad
    };
}());