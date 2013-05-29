pc.posteffect = {
    drawFullscreenQuad: function (device, target, vertexBuffer, shader) {
        device.setRenderTarget(target);
        device.updateBegin();
        device.updateLocalState({
            depthTest: false,
            depthWrite: false
        });
        device.setVertexBuffer(vertexBuffer, 0);
        device.setShader(shader);
        device.draw({
            type: pc.gfx.PRIMITIVE_TRISTRIP,
            base: 0,
            count: 4,
            indexed: false
        });
        device.clearLocalState();
        device.updateEnd();
    }
};