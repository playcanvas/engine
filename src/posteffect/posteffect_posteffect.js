pc.posteffect = {};

pc.extend(pc.posteffect, function () {
    var PostEffect = function (graphicsDevice) {
        this.device = graphicsDevice;
        this.shader = null;
        this.depthMap = null;
        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);
    };

    PostEffect.prototype = {
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