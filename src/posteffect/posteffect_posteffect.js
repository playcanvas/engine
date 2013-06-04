pc.posteffect = {
    createFullscreenQuad: function (graphicsDevice) {
        // Create the vertex format
        var vertexFormat = new pc.gfx.VertexFormat(graphicsDevice, [
            { semantic: pc.gfx.SEMANTIC_POSITION, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
        ]);

        // Create a vertex buffer
        var vertexBuffer = new pc.gfx.VertexBuffer(graphicsDevice, vertexFormat, 4);

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

    drawFullscreenQuad: function (graphicsDevice, target, vertexBuffer, shader) {
        graphicsDevice.setRenderTarget(target);
        graphicsDevice.updateBegin();
        graphicsDevice.updateLocalState({
            depthTest: false,
            depthWrite: false
        });
        graphicsDevice.setVertexBuffer(vertexBuffer, 0);
        graphicsDevice.setShader(shader);
        graphicsDevice.draw({
            type: pc.gfx.PRIMITIVE_TRISTRIP,
            base: 0,
            count: 4,
            indexed: false
        });
        graphicsDevice.clearLocalState();
        graphicsDevice.updateEnd();
    }
};