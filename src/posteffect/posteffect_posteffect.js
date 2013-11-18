pc.posteffect = {
    createFullscreenQuad: function (device) {
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
    },

    drawFullscreenQuad: function (device, target, vertexBuffer, shader) {
        device.setRenderTarget(target);
        device.updateBegin();
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
};