Object.assign(pc, (function () {
    'use strict';

    // Draws shaded full-screen quad in a single call
    var _postEffectQuadVB = null;
    var _postEffectQuadDraw = {
        type: pc.PRIMITIVE_TRISTRIP,
        base: 0,
        count: 4,
        indexed: false
    };

    function drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend) {
        if (_postEffectQuadVB === null) {
            var vertexFormat = new pc.VertexFormat(device, [{
                semantic: pc.SEMANTIC_POSITION,
                components: 2,
                type: pc.TYPE_FLOAT32
            }]);
            _postEffectQuadVB = new pc.VertexBuffer(device, vertexFormat, 4);

            var iterator = new pc.VertexIterator(_postEffectQuadVB);
            iterator.element[pc.SEMANTIC_POSITION].set(-1.0, -1.0);
            iterator.next();
            iterator.element[pc.SEMANTIC_POSITION].set(1.0, -1.0);
            iterator.next();
            iterator.element[pc.SEMANTIC_POSITION].set(-1.0, 1.0);
            iterator.next();
            iterator.element[pc.SEMANTIC_POSITION].set(1.0, 1.0);
            iterator.end();
        }

        var oldRt = device.renderTarget;
        device.setRenderTarget(target);
        device.updateBegin();

        var x, y, w, h;
        var sx, sy, sw, sh;
        if (!rect) {
            w = target ? target.width : device.width;
            h = target ? target.height : device.height;
            x = 0;
            y = 0;
        } else {
            x = rect.x;
            y = rect.y;
            w = rect.z;
            h = rect.w;
        }

        if (!scissorRect) {
            sx = x;
            sy = y;
            sw = w;
            sh = h;
        } else {
            sx = scissorRect.x;
            sy = scissorRect.y;
            sw = scissorRect.z;
            sh = scissorRect.w;
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
        device.setScissor(sx, sy, sw, sh);

        var oldDepthTest = device.getDepthTest();
        var oldDepthWrite = device.getDepthWrite();
        var oldCullMode = device.getCullMode();
        var oldWR = device.writeRed;
        var oldWG = device.writeGreen;
        var oldWB = device.writeBlue;
        var oldWA = device.writeAlpha;
        device.setDepthTest(false);
        device.setDepthWrite(false);
        device.setCullMode(pc.CULLFACE_NONE);
        device.setColorWrite(true, true, true, true);
        if (!useBlend) device.setBlending(false);

        device.setVertexBuffer(_postEffectQuadVB, 0);
        device.setShader(shader);

        device.draw(_postEffectQuadDraw);

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

    function destroyPostEffectQuad() {
        if (_postEffectQuadVB) {
            _postEffectQuadVB.destroy();
            _postEffectQuadVB = null;
        }
    }

    /**
     * @function
     * @name pc.drawTexture
     * @description Draws a texture in screen-space. Mostly used by post-effects.
     * @param {pc.GraphicsDevice} device - The graphics device used to draw the texture.
     * @param {pc.Texture} texture - The source texture to be drawn. Accessible as `uniform sampler2D source` in shader.
     * @param {pc.RenderTarget} [target] - The destination render target. Defaults to the frame buffer.
     * @param {pc.Shader} [shader] - The shader used for rendering the texture. Defaults to `fullscreenQuadVS` and `outputTex2DPS` in `pc.shaderChunks`.
     * @param {pc.Vec4} [rect] - The viewport rectangle to use for the texture, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
     * @param {pc.Vec4} [scissorRect] - The scissor rectangle to use for the texture, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
     * @param {boolean} [useBlend] - True to enable blending. Defaults to false, disabling blending.
     */
    function drawTexture(device, texture, target, shader, rect, scissorRect, useBlend) {
        if (!shader) {
            if (!device._copyShader) {
                var chunks = pc.shaderChunks;
                device._copyShader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.outputTex2DPS, "outputTex2D");
            }
            shader = device._copyShader;
        }

        device.constantTexSource.setValue(texture);
        drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend);
    }

    return {
        drawQuadWithShader: drawQuadWithShader,
        destroyPostEffectQuad: destroyPostEffectQuad,
        drawTexture: drawTexture
    };
}()));
