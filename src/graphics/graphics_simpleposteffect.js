pc.extend(pc.gfx, (function () {
    // Draws shaded full-screen quad in a single call
    var _postEffectQuadVB = null;

    function drawQuadWithShader(device, target, shader) {
        if (_postEffectQuadVB == null) {
            var vertexFormat = new pc.gfx.VertexFormat(device, [{
                semantic: pc.gfx.SEMANTIC_POSITION,
                components: 2,
                type: pc.gfx.ELEMENTTYPE_FLOAT32
            }]);
            _postEffectQuadVB = new pc.gfx.VertexBuffer(device, vertexFormat, 4);

            var iterator = new pc.gfx.VertexIterator(_postEffectQuadVB);
            iterator.element[pc.gfx.SEMANTIC_POSITION].set(-1.0, -1.0);
            iterator.next();
            iterator.element[pc.gfx.SEMANTIC_POSITION].set(1.0, -1.0);
            iterator.next();
            iterator.element[pc.gfx.SEMANTIC_POSITION].set(-1.0, 1.0);
            iterator.next();
            iterator.element[pc.gfx.SEMANTIC_POSITION].set(1.0, 1.0);
            iterator.end();
        }

        device.setRenderTarget(target);
        device.updateBegin();
        var w = (target !== null) ? target.width : device.width;
        var h = (target !== null) ? target.height : device.height;
        var x = 0;
        var y = 0;

        device.setViewport(x, y, w, h);
        device.setScissor(x, y, w, h);

        var oldDepthTest = device.getDepthTest();
        var oldDepthWrite = device.getDepthWrite();
        device.setDepthTest(false);
        device.setDepthWrite(false);
        device.setVertexBuffer(_postEffectQuadVB, 0);
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
        drawQuadWithShader: drawQuadWithShader
    };
}()));

